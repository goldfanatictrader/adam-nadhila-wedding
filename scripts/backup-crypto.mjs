import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
export function seal(input, key) {
  if (!/^[a-f0-9]{64}$/i.test(key || '')) throw new Error('Backup key must be 32-byte hex.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  const payload = Buffer.concat([cipher.update(input), cipher.final()]);
  return Buffer.concat([Buffer.from('CELEYO1'), iv, cipher.getAuthTag(), payload]);
}
export function open(input, key) {
  if (input.subarray(0, 7).toString() !== 'CELEYO1') throw new Error('Unsupported backup format');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), input.subarray(7, 19));
  decipher.setAuthTag(input.subarray(19, 35));
  return Buffer.concat([decipher.update(input.subarray(35)), decipher.final()]);
}
if (process.argv[1]?.endsWith('backup-crypto.mjs')) {
  const [mode, source, target] = process.argv.slice(2);
  if (!['seal', 'open'].includes(mode) || !source || !target)
    throw new Error(
      'Usage: node scripts/backup-crypto.mjs seal|open SOURCE TARGET (CELEYO_BACKUP_KEY in environment)',
    );
  writeFileSync(
    target,
    (mode === 'seal' ? seal : open)(readFileSync(source), process.env.CELEYO_BACKUP_KEY),
    { mode: 0o600 },
  );
  console.log('Backup conversion complete. Keep plaintext exports private.');
}
