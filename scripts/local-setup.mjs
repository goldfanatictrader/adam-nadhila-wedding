import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
if (!existsSync('.dev.vars')) {
  writeFileSync(
    '.dev.vars',
    `BETTER_AUTH_SECRET=${randomBytes(32).toString('hex')}\nGUEST_ENCRYPTION_KEY=${randomBytes(32).toString('hex')}\nRATE_LIMIT_SECRET=${randomBytes(32).toString('hex')}\n`,
    { mode: 0o600 },
  );
}
for (const args of [
  ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local'],
  ['node', 'scripts/seed.mjs'],
]) {
  const [cmd, ...rest] = args;
  const result = spawnSync(
    cmd === 'node' ? process.execPath : 'npx',
    cmd === 'node' ? rest : args,
    { stdio: 'inherit' },
  );
  if (result.status) process.exit(result.status);
}
