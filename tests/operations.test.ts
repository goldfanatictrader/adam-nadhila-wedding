import { describe, it, expect } from 'vitest';
import { fixtures } from './helpers';
import { runJobs } from '../src/lib/server/jobs';
import { createInvoice } from '../src/lib/server/billing';
import { uploadMedia } from '../src/lib/server/media';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
describe('scheduled cleanup and backup', () => {
  it('does not purge an expired event with a transfer awaiting review', async () => {
    const f = fixtures();
    try {
      const e = f.event('expired-event', f.owner);
      const invoice = await createInvoice(f.env, f.owner, e, {
        kind: 'extension',
        acceptTerms: true,
      });
      f.local.raw.prepare("UPDATE invoices SET status='pending_review' WHERE id=?").run(invoice.id);
      f.local.raw
        .prepare('UPDATE events SET expires_at=? WHERE id=?')
        .run(Date.now() - 40 * 86400000, e.id);
      await runJobs(f.env);
      expect(f.local.raw.prepare('SELECT draft FROM events WHERE id=?').get(e.id)!.draft).not.toBe(
        '{}',
      );
    } finally {
      f.local.close();
    }
  });
  it('marks purge before deleting objects, prevents a racing renewal, and safely retries', async () => {
    const f = fixtures();
    try {
      const e = f.event('expired-event', f.owner);
      await uploadMedia(
        f.env,
        f.owner,
        e,
        new Request('http://localhost/', {
          method: 'POST',
          body: readFileSync('assets/gallery-1.webp'),
        }),
      );
      f.local.raw
        .prepare('UPDATE events SET expires_at=? WHERE id=?')
        .run(Date.now() - 40 * 86400000, e.id);
      const original = f.env.MEDIA.delete.bind(f.env.MEDIA);
      let attempted = false;
      f.env.MEDIA.delete = (async (key: string) => {
        attempted = true;
        await expect(
          createInvoice(f.env, f.owner, e, { kind: 'extension', acceptTerms: true }),
        ).rejects.toThrow();
        await original(key);
      }) as R2Bucket['delete'];
      await runJobs(f.env);
      expect(attempted).toBe(true);
      expect(f.media.size).toBe(0);
      expect(
        f.local.raw.prepare('SELECT draft,status FROM events WHERE id=?').get(e.id),
      ).toMatchObject({ draft: '{}', status: 'deleted' });
      await runJobs(f.env);
    } finally {
      f.local.close();
    }
  });
  it('encrypts a backup, restores the exact export, and rejects a wrong key', () => {
    const folder = mkdtempSync(join(tmpdir(), 'celeyo-backup-test-'));
    try {
      const sql =
        "CREATE TABLE sample(id TEXT PRIMARY KEY);\nINSERT INTO sample VALUES('data with quotes');\n";
      const source = join(folder, 'source.sql'),
        encrypted = join(folder, 'backup.enc'),
        restored = join(folder, 'restore.sql');
      writeFileSync(source, sql);
      const env = { ...process.env, CELEYO_BACKUP_KEY: 'a'.repeat(64) };
      expect(
        spawnSync(process.execPath, ['scripts/backup-crypto.mjs', 'seal', source, encrypted], {
          env,
        }).status,
      ).toBe(0);
      expect(readFileSync(encrypted).includes(Buffer.from(sql))).toBe(false);
      expect(
        spawnSync(process.execPath, ['scripts/backup-crypto.mjs', 'open', encrypted, restored], {
          env,
        }).status,
      ).toBe(0);
      expect(readFileSync(restored, 'utf8')).toBe(sql);
      expect(
        spawnSync(process.execPath, ['scripts/backup-crypto.mjs', 'open', encrypted, restored], {
          env: { ...env, CELEYO_BACKUP_KEY: 'b'.repeat(64) },
        }).status,
      ).not.toBe(0);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
