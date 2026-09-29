import type { Env, EventRow } from '../types';
import { all, one, stmt, atomic, now } from './db';
import { lifecycle } from './events';
import { brandedEmail } from './email-brand';
export async function runJobs(env: Env) {
  const stamp = now();
  await env.DB.batch([
    stmt(env.DB, 'DELETE FROM rate_limits WHERE expires_at<?', stamp),
    stmt(env.DB, 'DELETE FROM guest_sessions WHERE expires_at<?', stamp),
    stmt(env.DB, 'DELETE FROM admin_elevations WHERE expires_at<?', stamp),
    stmt(env.DB, 'DELETE FROM support_access WHERE expires_at<?', stamp),
    stmt(
      env.DB,
      "UPDATE invoices SET status='expired' WHERE status='pending_transfer' AND expires_at<?",
      stamp,
    ),
  ]);
  const runs = await all<{ id: string; event_id: string; tenant_id: string }>(
    env.DB,
    "SELECT id,event_id,tenant_id FROM ai_runs WHERE status='running' AND created_at<? LIMIT 50",
    stamp - 120000,
  );
  for (const run of runs) {
    try {
      await atomic(
        env.DB,
        "SELECT status='running' FROM ai_runs WHERE id=?",
        [run.id],
        [
          stmt(env.DB, "UPDATE ai_runs SET status='failed' WHERE id=?", run.id),
          stmt(
            env.DB,
            'UPDATE events SET ai_reserved=max(0,ai_reserved-1) WHERE id=? AND tenant_id=?',
            run.event_id,
            run.tenant_id,
          ),
        ],
      );
    } catch {}
  }
  const dangling = await all<{ id: string; object_key: string }>(
    env.DB,
    "SELECT id,object_key FROM media_assets WHERE status='deleting' OR (status='pending' AND created_at<?) LIMIT 100",
    stamp - 3600000,
  );
  for (const asset of dangling) {
    await env.MEDIA.delete(asset.object_key);
    await stmt(
      env.DB,
      'DELETE FROM media_assets WHERE id=? AND NOT EXISTS(SELECT 1 FROM media_refs WHERE asset_id=?)',
      asset.id,
      asset.id,
    ).run();
  }
  // Cursor-based bounded sweeps avoid repeatedly scanning only the first batch of tenants.
  const cursor = await one<{ value: string }>(
    env.DB,
    "SELECT value FROM settings WHERE key='jobs_cursor'",
  );
  const events = await all<EventRow & { email: string; purge_started_at: number | null }>(
    env.DB,
    'SELECT e.*,u.email FROM events e JOIN user u ON u.id=e.owner_id WHERE e.id>? ORDER BY e.id LIMIT 100',
    cursor?.value || '',
  );
  for (const e of events) {
    const life = lifecycle(e);
    if (e.plan && !e.activated_at && life.activation && life.activation <= stamp)
      await stmt(
        env.DB,
        'UPDATE events SET activated_at=?,expires_at=? WHERE id=? AND activated_at IS NULL',
        life.activation,
        life.expires,
        e.id,
      ).run();
    const expiry = e.plan ? life.expires : e.trial_expires_at;
    if (expiry) {
      const remaining = Math.ceil((expiry - stamp) / 86400000);
      const threshold = [14, 7, 1, 0].find((d) => remaining <= d && remaining > d - 1);
      if (threshold !== undefined)
        await stmt(
          env.DB,
          'INSERT OR IGNORE INTO outbox(id,recipient,subject,body,next_at) VALUES(?,?,?,?,?)',
          `expiry:${e.id}:${expiry}:${threshold}`,
          e.email,
          'Masa aktif undangan CELEYO',
          `Undangan ${e.title} ${remaining > 0 ? `akan berakhir dalam ${remaining} hari` : 'telah berakhir'}. Anda memiliki 30 hari untuk ekspor/perpanjangan sebelum data undangan dihapus. Buka ${env.PUBLIC_SITE_URL}/app.`,
          stamp,
        ).run();
    }
    const purgeAt = e.deleted_at
      ? e.deleted_at + 30 * 86400000
      : expiry
        ? expiry + 30 * 86400000
        : null;
    if (
      (e.purge_started_at || (purgeAt && purgeAt < stamp)) &&
      e.draft !== '{}' &&
      !(await one(
        env.DB,
        "SELECT id FROM invoices WHERE event_id=? AND status IN ('pending_transfer','pending_review','needs_clarification')",
        e.id,
      )) &&
      !(await one(
        env.DB,
        "SELECT id FROM setup_tickets WHERE event_id=? AND status!='completed'",
        e.id,
      ))
    ) {
      if (!e.purge_started_at) {
        try {
          await atomic(
            env.DB,
            `SELECT version=? AND expires_at IS ? AND deleted_at IS ? AND NOT EXISTS(SELECT 1 FROM invoices WHERE event_id=? AND status IN ('pending_transfer','pending_review','needs_clarification')) AND NOT EXISTS(SELECT 1 FROM setup_tickets WHERE event_id=? AND status!='completed') FROM events WHERE id=? AND tenant_id=?`,
            [e.version, e.expires_at, e.deleted_at, e.id, e.id, e.id, e.tenant_id],
            [
              stmt(
                env.DB,
                "UPDATE events SET status='deleted',purge_started_at=? WHERE id=? AND tenant_id=?",
                stamp,
                e.id,
                e.tenant_id,
              ),
            ],
          );
        } catch {
          continue;
        }
      }
      const assets = await all<{ object_key: string }>(
        env.DB,
        'SELECT object_key FROM media_assets WHERE event_id=? AND tenant_id=?',
        e.id,
        e.tenant_id,
      );
      for (const asset of assets) await env.MEDIA.delete(asset.object_key);
      await env.DB.batch(
        [
          'media_refs',
          'media_assets',
          'guests',
          'content_versions',
          'ai_runs',
          'event_members',
          'support_access',
        ]
          .map((table) =>
            stmt(
              env.DB,
              `DELETE FROM ${table} WHERE event_id=? AND tenant_id=?`,
              e.id,
              e.tenant_id,
            ),
          )
          .concat([
            stmt(
              env.DB,
              "UPDATE events SET status='deleted',draft='{}',published=NULL,plan_snapshot=NULL,title='Undangan dihapus',ai_reserved=0,deleted_at=coalesce(deleted_at,?) WHERE id=?",
              stamp,
              e.id,
            ),
          ]),
      );
    }
  }
  await stmt(
    env.DB,
    "INSERT INTO settings VALUES('jobs_cursor',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
    events.length === 100 ? events.at(-1)!.id : '',
    stamp,
  ).run();
  if (env.APP_ENV !== 'local' && env.EMAIL) {
    const mails = await all<{ id: string; recipient: string; subject: string; body: string }>(
      env.DB,
      "SELECT * FROM outbox WHERE (status='pending' OR (status='sending' AND lease_until<?)) AND next_at<=? AND attempts<8 LIMIT 20",
      stamp,
      stamp,
    );
    for (const mail of mails) {
      const leased = await stmt(
        env.DB,
        "UPDATE outbox SET status='sending',lease_until=?,attempts=attempts+1 WHERE id=? AND (status='pending' OR lease_until<?)",
        stamp + 60000,
        mail.id,
        stamp,
      ).run();
      if (!leased.meta.changes) continue;
      try {
        await env.EMAIL.send({
          to: mail.recipient,
          from: env.EMAIL_FROM,
          subject: mail.subject,
          ...brandedEmail(mail.subject, mail.body, env.PUBLIC_SITE_URL),
        });
        await stmt(
          env.DB,
          "UPDATE outbox SET status='sent',sent_at=? WHERE id=?",
          now(),
          mail.id,
        ).run();
      } catch {
        await stmt(
          env.DB,
          "UPDATE outbox SET status='pending',next_at=?,lease_until=NULL WHERE id=?",
          now() + 15 * 60000,
          mail.id,
        ).run();
      }
    }
  }
  const retention = await one<{ value: string }>(
    env.DB,
    "SELECT value FROM settings WHERE key='billing_retention_days'",
  );
  const retentionDays = Number(retention?.value);
  if (Number.isInteger(retentionDays) && retentionDays >= 30 && retentionDays <= 3650) {
    const cutoff = stamp - retentionDays * 86400000;
    const old = await all<{ id: string }>(
      env.DB,
      "SELECT i.id FROM invoices i JOIN events e ON e.id=i.event_id WHERE e.status='deleted' AND e.draft='{}' AND i.status IN ('paid','refunded','expired','cancelled') AND coalesce(i.paid_at,i.created_at)<? LIMIT 100",
      cutoff,
    );
    for (const invoice of old)
      await env.DB.batch(
        ['grants', 'payments', 'refunds', 'setup_tickets']
          .map((table) => stmt(env.DB, `DELETE FROM ${table} WHERE invoice_id=?`, invoice.id))
          .concat([stmt(env.DB, 'DELETE FROM invoices WHERE id=?', invoice.id)]),
      );
    await stmt(env.DB, 'DELETE FROM audit_events WHERE created_at<?', cutoff).run();
    await stmt(
      env.DB,
      "DELETE FROM manual_grants WHERE created_at<? AND event_id IN (SELECT id FROM events WHERE status='deleted' AND draft='{}')",
      cutoff,
    ).run();
  }
  await stmt(
    env.DB,
    "DELETE FROM outbox WHERE (status='sent' AND sent_at<?) OR (attempts>=8 AND next_at<?)",
    stamp - 30 * 86400000,
    stamp - 7 * 86400000,
  ).run();
}
