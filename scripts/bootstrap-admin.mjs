import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const email = process.argv.find((x) => x.startsWith('--email='))?.slice(8);
const remote = process.argv.includes('--remote');
if (!email || !/^\S+@\S+\.\S+$/.test(email))
  throw new Error(
    'Usage: npm run bootstrap:admin -- --email=verified@example.com [--remote --config=wrangler.production.json]',
  );
const config = process.argv.find((x) => x.startsWith('--config='))?.slice(9);
if (remote && !config)
  throw new Error('Remote bootstrap requires explicit production/staging config.');
const literal = "'" + email.replaceAll("'", "''") + "'";
const folder = mkdtempSync(join(tmpdir(), 'celeyo-admin-'));
try {
  const file = join(folder, 'bootstrap.sql');
  writeFileSync(
    file,
    `INSERT INTO transaction_guards VALUES('bootstrap-admin',COALESCE((SELECT emailVerified=1 FROM user WHERE lower(email)=lower(${literal})),0));\nINSERT OR IGNORE INTO operators SELECT id FROM user WHERE lower(email)=lower(${literal}) AND emailVerified=1;\nINSERT INTO audit_events(id,actor_id,action,detail,created_at) SELECT lower(hex(randomblob(16))),id,'operator.bootstrap','Explicit operator CLI',unixepoch()*1000 FROM user WHERE lower(email)=lower(${literal});\nDELETE FROM transaction_guards WHERE id='bootstrap-admin';`,
    { mode: 0o600 },
  );
  const result = spawnSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      'DB',
      remote ? '--remote' : '--local',
      ...(config ? ['--config', config] : []),
      '--file',
      file,
    ],
    { encoding: 'utf8' },
  );
  if (result.status)
    throw new Error(
      'Bootstrap failed: ensure the verified user exists and the selected database is configured.',
    );
  console.log(
    'Operator registered. Enroll TOTP in /account, then reauthenticate at /superadmin. No password was created or reset.',
  );
} finally {
  rmSync(folder, { recursive: true, force: true });
}
