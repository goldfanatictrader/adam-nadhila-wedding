import { z } from 'zod';
import type { Actor, Env, EventRow } from '../types';
import {
  blankContent,
  contentSchema,
  assetIds,
  eventTime,
  publishErrors,
  type Content,
} from '../content';
import { templates, addMonths, plans } from '../catalog';
import { accessEvent, workspace } from './auth';
import { all, one, stmt, atomic, audit, id, now } from './db';
import { fail } from './http';
export const createSchema = z.object({
  title: z.string().trim().min(3).max(100),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .min(3)
    .max(64)
    .refine((v) => !['admin', 'api', 'app', 'demo', 'superadmin'].includes(v)),
  templateId: z.enum(['minimal-ivory', 'botanical-bloom', 'editorial-journey']),
});
export const saveSchema = z.object({
  version: z.number().int().positive(),
  templateId: createSchema.shape.templateId,
  content: contentSchema,
});
export function lifecycle(e: EventRow) {
  const activation = e.activated_at ?? (e.paid_at ? e.paid_at + 90 * 86400000 : null);
  const expires =
    e.expires_at ??
    (activation
      ? addMonths(activation, e.duration_months, JSON.parse(e.draft).timezone || 'Asia/Jakarta')
      : null);
  return { activation, expires };
}
export function editable(e: EventRow) {
  if (e.status === 'suspended' || e.status === 'deleted') fail(403, 'Undangan sedang tidak aktif.');
  if (!e.plan && e.trial_expires_at < now())
    fail(402, 'Masa pratinjau berakhir. Pilih paket untuk melanjutkan.');
  const { expires } = lifecycle(e);
  if (e.plan && expires && expires < now())
    fail(402, 'Masa aktif berakhir. Perpanjang untuk mengedit.');
}
export function publicActive(e: EventRow) {
  const { expires } = lifecycle(e);
  return e.status === 'published' && !!e.published && !!e.plan && !!expires && expires > now();
}
export async function publicEvent(env: Env, slug: string) {
  const e = await one<EventRow>(
    env.DB,
    "SELECT e.* FROM events e JOIN tenants t ON t.id=e.tenant_id WHERE e.slug=? AND t.status='active'",
    slug,
  );
  if (!e || !publicActive(e))
    fail(404, 'Undangan belum tersedia atau masa aktifnya telah berakhir.');
  return e;
}
export async function createEvent(env: Env, a: Actor, input: z.infer<typeof createSchema>) {
  const tenant = await workspace(env, a),
    eventId = id(),
    stamp = now();
  const c = {
    ...blankContent,
    palette:
      input.templateId === 'botanical-bloom'
        ? 'sage'
        : input.templateId === 'editorial-journey'
          ? 'terracotta'
          : 'ivory',
  };
  const data = JSON.stringify(c);
  await atomic(
    env.DB,
    `SELECT trial_used=? AND NOT EXISTS(SELECT 1 FROM events WHERE tenant_id=? AND plan IS NULL AND status!='deleted') AND EXISTS(SELECT 1 FROM catalog_templates WHERE id=? AND available=1) FROM tenants WHERE id=?`,
    [tenant.trial_used, tenant.id, input.templateId, tenant.id],
    [
      stmt(
        env.DB,
        'INSERT INTO events(id,tenant_id,owner_id,slug,title,template_id,draft,trial_expires_at,created_at,ai_credits,media_limit,photo_limit) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
        eventId,
        tenant.id,
        a.id,
        input.slug,
        input.title,
        input.templateId,
        data,
        stamp + 7 * 86400000,
        stamp,
        tenant.trial_used ? 0 : 3,
        tenant.trial_used ? 0 : 25_000_000,
        tenant.trial_used ? 0 : 3,
      ),
      stmt(env.DB, 'UPDATE tenants SET trial_used=1 WHERE id=?', tenant.id),
      stmt(
        env.DB,
        'INSERT INTO content_versions VALUES(?,?,?,?,?,?)',
        tenant.id,
        eventId,
        1,
        JSON.stringify({ content: c, templateId: input.templateId }),
        a.id,
        stamp,
      ),
      audit(env, a.id, 'event.create', tenant.id, eventId),
    ],
  );
  return { id: eventId };
}
export async function listEvents(env: Env, a: Actor) {
  await workspace(env, a);
  return all<EventRow>(
    env.DB,
    "SELECT e.* FROM events e JOIN tenants t ON t.id=e.tenant_id WHERE t.status='active' AND e.status!='deleted' AND (e.owner_id=? OR EXISTS(SELECT 1 FROM event_members m WHERE m.event_id=e.id AND m.tenant_id=e.tenant_id AND m.user_id=?)) ORDER BY e.created_at DESC LIMIT 100",
    a.id,
    a.id,
  );
}
function references(env: Env, e: EventRow, c: Content, state: 'draft' | 'published') {
  return [
    stmt(
      env.DB,
      'DELETE FROM media_refs WHERE event_id=? AND tenant_id=? AND state=?',
      e.id,
      e.tenant_id,
      state,
    ),
    ...assetIds(c).map((asset) =>
      stmt(env.DB, 'INSERT INTO media_refs VALUES(?,?,?,?)', e.tenant_id, e.id, asset, state),
    ),
  ];
}
export async function saveEvent(
  env: Env,
  a: Actor,
  e: EventRow,
  input: z.infer<typeof saveSchema>,
) {
  editable(e);
  const ids = assetIds(input.content);
  for (const asset of ids)
    if (
      !(await one(
        env.DB,
        "SELECT id FROM media_assets WHERE id=? AND tenant_id=? AND event_id=? AND status='ready'",
        asset,
        e.tenant_id,
        e.id,
      ))
    )
      fail(400, 'Aset tidak tersedia untuk undangan ini.');
  const next = input.version + 1;
  const readyClause = ids.length
    ? ` AND (SELECT count(*) FROM media_assets WHERE event_id=? AND tenant_id=? AND status='ready' AND id IN (${ids.map(() => '?').join(',')}))=?`
    : '';
  await atomic(
    env.DB,
    "SELECT version=? AND status NOT IN ('suspended','deleted')" +
      readyClause +
      ' FROM events WHERE id=? AND tenant_id=?',
    [
      input.version,
      ...(ids.length ? [e.id, e.tenant_id, ...ids, ids.length] : []),
      e.id,
      e.tenant_id,
    ],
    [
      stmt(
        env.DB,
        'UPDATE events SET draft=?,template_id=?,version=? WHERE id=? AND tenant_id=?',
        JSON.stringify(input.content),
        input.templateId,
        next,
        e.id,
        e.tenant_id,
      ),
      stmt(
        env.DB,
        'INSERT INTO content_versions VALUES(?,?,?,?,?,?)',
        e.tenant_id,
        e.id,
        next,
        JSON.stringify({ content: input.content, templateId: input.templateId }),
        a.id,
        now(),
      ),
      ...references(env, e, input.content, 'draft'),
      audit(env, a.id, 'event.save', e.tenant_id, e.id),
    ],
  );
  return { version: next };
}
export async function publishEvent(env: Env, a: Actor, e: EventRow, version: number) {
  editable(e);
  if (!e.plan) fail(402, 'Paket perlu diaktifkan sebelum publikasi.');
  const c = contentSchema.parse(JSON.parse(e.draft)),
    errors = publishErrors(c);
  if (errors.length) fail(400, errors.join(' '));
  const template = templates.find((t) => t.id === e.template_id);
  if (!template) fail(400, 'Template tidak tersedia.');
  if (e.plan === 'starter' && (template.minPlan !== 'starter' || c.hideBrand))
    fail(403, 'Template atau pengaturan branding memerlukan Premium.');
  if (
    !(await one(
      env.DB,
      'SELECT id FROM catalog_templates WHERE id=? AND version=? AND available=1',
      e.template_id,
      e.template_version,
    ))
  )
    fail(403, 'Template sedang tidak tersedia. Pilih template lain.');
  const activation = e.activated_at ?? Math.min(now(), e.paid_at! + 90 * 86400000);
  const expiry = e.expires_at ?? addMonths(activation, e.duration_months, c.timezone);
  if (eventTime(c) > expiry)
    fail(
      400,
      'Masa aktif belum mencakup tanggal acara. Pilih perpanjangan atau paket yang sesuai.',
    );
  const ids = assetIds(c),
    readyClause = ids.length
      ? ` AND (SELECT count(*) FROM media_assets WHERE event_id=? AND tenant_id=? AND status='ready' AND id IN (${ids.map(() => '?').join(',')}))=?`
      : '';
  await atomic(
    env.DB,
    "SELECT version=? AND plan=? AND status NOT IN ('suspended','deleted')" +
      readyClause +
      ' FROM events WHERE id=? AND tenant_id=?',
    [
      version,
      e.plan,
      ...(ids.length ? [e.id, e.tenant_id, ...ids, ids.length] : []),
      e.id,
      e.tenant_id,
    ],
    [
      stmt(
        env.DB,
        "UPDATE events SET published=draft,published_version=version,published_template_id=template_id,status='published',activated_at=?,expires_at=? WHERE id=? AND tenant_id=?",
        activation,
        expiry,
        e.id,
        e.tenant_id,
      ),
      ...references(env, e, c, 'published'),
      audit(env, a.id, 'event.publish', e.tenant_id, e.id),
    ],
  );
  return { url: `${env.PUBLIC_SITE_URL}/i/${e.slug}`, expiresAt: expiry };
}
export async function eventDetail(env: Env, a: Actor, eventId: string) {
  const e = await accessEvent(env, a, eventId);
  const stats = await one(
    env.DB,
    "SELECT (SELECT count(*) FROM guests WHERE event_id=?) guests,(SELECT count(*) FROM responses WHERE event_id=? AND attending=1) attending,(SELECT coalesce(sum(party),0) FROM responses WHERE event_id=?) people,(SELECT count(*) FROM responses WHERE event_id=? AND message!='') wishes,(SELECT coalesce(sum(size),0) FROM media_assets WHERE event_id=?) bytes",
    e.id,
    e.id,
    e.id,
    e.id,
    e.id,
  );
  return {
    ...e,
    draft: JSON.parse(e.draft),
    published: e.published ? JSON.parse(e.published) : null,
    owner: e.owner_id === a.id,
    stats,
    lifecycle: lifecycle(e),
  };
}
export async function deleteEvent(env: Env, a: Actor, e: EventRow) {
  await atomic(
    env.DB,
    "SELECT NOT EXISTS(SELECT 1 FROM invoices WHERE event_id=? AND status IN ('pending_transfer','pending_review','needs_clarification')) AND NOT EXISTS(SELECT 1 FROM setup_tickets WHERE event_id=? AND status!='completed')",
    [e.id, e.id],
    [
      stmt(
        env.DB,
        "UPDATE events SET status='deleted',deleted_at=? WHERE id=? AND tenant_id=?",
        now(),
        e.id,
        e.tenant_id,
      ),
      audit(env, a.id, 'event.delete_requested', e.tenant_id, e.id),
    ],
  );
  return { message: 'Undangan dinonaktifkan. Data dijadwalkan dihapus setelah 30 hari.' };
}
export async function addEditor(env: Env, a: Actor, e: EventRow, email: string) {
  editable(e);
  if (e.plan !== 'signature') fail(403, 'Kolaborator memerlukan Signature.');
  const user = await one<{ id: string }>(
    env.DB,
    'SELECT id FROM user WHERE lower(email)=lower(?) AND emailVerified=1',
    email,
  );
  if (!user || user.id === e.owner_id)
    fail(400, 'Gunakan email akun klien lain yang telah diverifikasi.');
  await atomic(
    env.DB,
    'SELECT count(*)<1 FROM event_members WHERE event_id=?',
    [e.id],
    [
      stmt(env.DB, 'INSERT INTO event_members VALUES(?,?,?)', e.tenant_id, e.id, user.id),
      audit(env, a.id, 'editor.add', e.tenant_id, e.id),
    ],
  );
  return { ok: true };
}
