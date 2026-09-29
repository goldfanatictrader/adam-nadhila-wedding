import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
const owner = process.argv.find((a) => a.startsWith('--owner-id='))?.slice(11);
const configPath = process.argv.find((a) => a.startsWith('--config='))?.slice(9);
if (!owner || !configPath)
  throw new Error(
    'Usage: node scripts/provision-pilot.mjs --owner-id=VERIFIED_USER_ID --config=wrangler.deploy.json',
  );
const config = JSON.parse(readFileSync(configPath, 'utf8'));
if (!['staging', 'production'].includes(config.vars?.APP_ENV))
  throw new Error('Use an explicit staging/production config.');
const content = JSON.parse(readFileSync('scripts/pilot-data.json', 'utf8'));
const book = JSON.parse(readFileSync('scripts/launch-prices.json', 'utf8'));
const run = (args) => {
  const r = spawnSync('npx', ['wrangler', ...args, '--config', configPath], { encoding: 'utf8' });
  if (r.status)
    throw new Error('Cloudflare command failed. Inspect resource access and configured bindings.');
  return r.stdout;
};
const quote = (v) =>
  v === null
    ? 'NULL'
    : typeof v === 'number'
      ? String(v)
      : "'" + String(v).replaceAll("'", "''") + "'";
const sql = (text, ...values) => {
  let i = 0;
  return text.replace(/\?/g, () => quote(values[i++]));
};
const query = (text) =>
  JSON.parse(run(['d1', 'execute', 'DB', '--remote', '--command', text, '--json']))[0].results;
const user = query(sql('SELECT id,emailVerified FROM user WHERE id=?', owner))[0];
if (!user?.emailVerified)
  throw new Error('Pilot owner must already have a verified CELEYO account.');
const exists = query("SELECT id FROM events WHERE slug='adam-nadhila'")[0];
if (exists) {
  console.log('Pilot already exists; skipped without overwriting content, tokens or entitlement.');
  process.exit(0);
}
const tenant = query(sql('SELECT id FROM tenants WHERE owner_id=?', owner))[0]?.id || randomUUID(),
  event = randomUUID(),
  stamp = Date.now();
const expiry = new Date(stamp);
expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
const used = new Set([
  content.hero,
  content.introPhoto,
  content.eventPhoto,
  content.closingPhoto,
  content.music.asset,
  ...content.gallery.map((x) => x.id),
  ...content.story.flatMap((s) => [s.photo, s.photo2, ...(s.moments || [])].filter(Boolean)),
]);
const replacements = new Map([...used].map((old) => [old, randomUUID()]));
const replace = (value) =>
  typeof value === 'string'
    ? replacements.get(value) || value
    : Array.isArray(value)
      ? value.map(replace)
      : value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replace(v)]))
        : value;
const imported = replace(content);
const writes = [
  sql(
    'INSERT OR IGNORE INTO tenants(id,owner_id,trial_used,created_at) VALUES(?,?,1,?);',
    tenant,
    owner,
    stamp,
  ),
  sql(
    "INSERT INTO events(id,tenant_id,owner_id,slug,title,template_id,draft,version,status,plan,plan_snapshot,paid_at,duration_months,ai_credits,media_limit,photo_limit,guest_limit,trial_expires_at,created_at) VALUES(?,?,?,'adam-nadhila','Pernikahan Adam & Nadhila','editorial-journey',?,1,'draft','signature',?,?,12,150,500000000,40,1500,?,?);",
    event,
    tenant,
    owner,
    JSON.stringify(imported),
    JSON.stringify({ book, grant: 'pilot' }),
    stamp,
    stamp + 7 * 86400000,
    stamp,
  ),
  sql(
    'INSERT INTO content_versions VALUES(?,?,1,?,?,?);',
    tenant,
    event,
    JSON.stringify({ content: imported, templateId: 'editorial-journey' }),
    owner,
    stamp,
  ),
  sql(
    'INSERT INTO audit_events VALUES(?,?,?,?,?,?,?);',
    randomUUID(),
    owner,
    tenant,
    event,
    'pilot.grant',
    'Explicit pilot migration; Signature grant, no revenue; owner must publish',
    stamp,
  ),
];
const uploaded = [];
const folder = mkdtempSync(join(tmpdir(), 'celeyo-pilot-'));
try {
  for (const [original, id] of replacements) {
    const name = original
      .slice(6)
      .replace(/-webp$/, '.webp')
      .replace(/-mp3$/, '.mp3');
    const file = join('assets', name),
      bytes = readFileSync(file),
      key = `${tenant}/${event}/${id}`,
      mime = name.endsWith('.mp3') ? 'audio/mpeg' : 'image/webp';
    run([
      'r2',
      'object',
      'put',
      `${config.r2_buckets[0].bucket_name}/${key}`,
      '--remote',
      '--file',
      file,
      '--content-type',
      mime,
    ]);
    uploaded.push(key);
    writes.push(
      sql(
        "INSERT INTO media_assets(id,tenant_id,event_id,object_key,filename,mime,size,kind,status,created_at,checksum) VALUES(?,?,?,?,?,?,?,?,'ready',?,?);",
        id,
        tenant,
        event,
        key,
        name,
        mime,
        bytes.length,
        mime.startsWith('image') ? 'image' : 'audio',
        stamp,
        createHash('sha256').update(bytes).digest('hex'),
      ),
      sql("INSERT INTO media_refs VALUES(?,?,?,'draft');", tenant, event, id),
    );
  }
  const file = join(folder, 'pilot.sql');
  writeFileSync(file, writes.join('\n'), { mode: 0o600 });
  run(['d1', 'execute', 'DB', '--remote', '--file', file]);
  console.log(
    'Pilot imported as a private draft with an audited Signature grant. The owner can review and publish it from /app.',
  );
} catch (error) {
  console.error(
    'Pilot import interrupted. Review partial database writes before retrying. Uploaded objects are confined to the new pilot event prefix.',
  );
  throw error;
} finally {
  rmSync(folder, { recursive: true, force: true });
}
