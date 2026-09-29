import { seal } from './backup-crypto.mjs';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
const run = (command, args) => {
  const r = spawnSync(command, args, { stdio: 'inherit' });
  if (r.error || r.status !== 0) throw new Error(`${command} failed; deployment stopped.`);
};
if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID)
  throw new Error('Cloudflare credentials are required.');
if (!/^[a-f0-9]{64}$/i.test(process.env.CELEYO_BACKUP_KEY || ''))
  throw new Error('Configure CELEYO_BACKUP_KEY before deployment.');
run(process.execPath, ['scripts/configure-cloudflare.mjs']);
// Explicit secrets input, separate from source and public build variables.
const secrets = JSON.parse(process.env.CELEYO_WORKER_SECRETS || '{}');
for (const key of [
  'BETTER_AUTH_SECRET',
  'GUEST_ENCRYPTION_KEY',
  'RATE_LIMIT_SECRET',
  'TURNSTILE_SECRET_KEY',
])
  if (typeof secrets[key] !== 'string' || secrets[key].length < 32)
    throw new Error(`CELEYO_WORKER_SECRETS must contain a strong ${key}.`);
if (!/^[a-f0-9]{64}$/i.test(secrets.GUEST_ENCRYPTION_KEY))
  throw new Error('GUEST_ENCRYPTION_KEY must be 32-byte hex. Preserve it across deployments.');
process.env.CLOUDFLARE_WRANGLER_CONFIG = 'wrangler.deploy.json';
// Adapter reads the explicitly selected config; no local bindings reach production.
run('npx', ['astro', 'build']);
mkdirSync('backups', { recursive: true });
const backup = `backups/predeploy-${Date.now()}.sql`;
run('npx', [
  'wrangler',
  'd1',
  'export',
  'DB',
  '--remote',
  '--config',
  'wrangler.deploy.json',
  '--output',
  backup,
]);
writeFileSync(backup + '.enc', seal(readFileSync(backup), process.env.CELEYO_BACKUP_KEY), {
  mode: 0o600,
});
rmSync(backup);
run('npx', [
  'wrangler',
  'd1',
  'migrations',
  'apply',
  'DB',
  '--remote',
  '--config',
  'wrangler.deploy.json',
]);
run('npx', ['wrangler', 'deploy', '--config', 'dist/server/wrangler.json']);
const path = 'secrets.local.json';
try {
  writeFileSync(path, JSON.stringify(secrets), { mode: 0o600 });
  run('npx', ['wrangler', 'secret', 'bulk', path, '--config', 'dist/server/wrangler.json']);
} finally {
  if (existsSync(path)) rmSync(path);
}
const origin = process.env.PUBLIC_SITE_URL;
for (let attempt = 0; attempt < 6; attempt++) {
  try {
    const response = await fetch(origin + '/api/health', { signal: AbortSignal.timeout(10000) });
    if (response.ok && (await response.json()).service === 'CELEYO') {
      console.log('CELEYO deployment smoke check passed.');
      process.exit(0);
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 5000));
}
throw new Error(
  'Deployment health check failed; review deployment and restore/rollback instructions.',
);
