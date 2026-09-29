import { z } from 'zod';
import type { Actor, Env, EventRow } from '../types';
import { normalizePhone, whatsappUrl, csvCell } from '../content';
import { all, one, stmt, atomic, audit, id, now } from './db';
import { digest, token, encrypt, decrypt } from './crypto';
import { editable, publicEvent } from './events';
import { fail } from './http';
import { rateLimit } from './security';
export const guestInput = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().max(30).default(''),
  group: z.string().max(80).default(''),
  maxParty: z.number().int().min(1).max(20).default(4),
});
export type Guest = {
  id: string;
  tenant_id: string;
  event_id: string;
  name: string;
  phone: string;
  group_name: string;
  max_party: number;
  token_hash: string | null;
  token_cipher: string | null;
  token_version: number;
};
export async function addGuests(
  env: Env,
  a: Actor,
  e: EventRow,
  inputs: z.infer<typeof guestInput>[],
) {
  editable(e);
  if (!e.plan) fail(402, 'Aktifkan paket untuk menambahkan tamu.');
  if (inputs.length > 100 || !inputs.length) fail(400, 'Impor 1–100 tamu per permintaan.');
  const writes: D1PreparedStatement[] = [];
  for (const g of inputs) {
    let phone: string;
    try {
      phone = normalizePhone(g.phone);
    } catch {
      fail(400, 'Nomor WhatsApp tidak valid.');
    }
    const guestId = id(),
      raw = token(),
      aad = `${e.tenant_id}:${e.id}:${guestId}`;
    writes.push(
      stmt(
        env.DB,
        'INSERT INTO guests(id,tenant_id,event_id,name,phone,group_name,max_party,token_hash,token_cipher,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
        guestId,
        e.tenant_id,
        e.id,
        g.name,
        phone,
        g.group,
        g.maxParty,
        await digest(raw),
        await encrypt(raw, env.GUEST_ENCRYPTION_KEY, aad),
        now(),
      ),
    );
  }
  await atomic(
    env.DB,
    'SELECT (SELECT count(*) FROM guests WHERE event_id=? AND tenant_id=?)+?<=guest_limit FROM events WHERE id=? AND tenant_id=?',
    [e.id, e.tenant_id, inputs.length, e.id, e.tenant_id],
    [...writes, audit(env, a.id, 'guests.add', e.tenant_id, e.id, String(inputs.length))],
  );
  return { added: inputs.length };
}
export async function listGuests(env: Env, e: EventRow, page = 1, query = '') {
  return all(
    env.DB,
    `SELECT g.id,g.name,g.phone,g.group_name,g.max_party,g.sent_at,g.clicked_at,g.opened_at,g.token_hash IS NOT NULL AS code_active,r.attending,r.party,r.message,r.hidden,r.version FROM guests g LEFT JOIN responses r ON r.event_id=g.event_id AND r.guest_id=g.id WHERE g.tenant_id=? AND g.event_id=? AND (g.name LIKE ? ESCAPE '\\' OR g.group_name LIKE ? ESCAPE '\\') ORDER BY g.created_at,g.id LIMIT 50 OFFSET ?`,
    e.tenant_id,
    e.id,
    `%${query.replace(/[\\%_]/g, '\\$&')}%`,
    `%${query.replace(/[\\%_]/g, '\\$&')}%`,
    (page - 1) * 50,
  );
}
export async function guestLink(env: Env, e: EventRow, guestId: string) {
  const g = await one<Guest>(
    env.DB,
    'SELECT * FROM guests WHERE id=? AND tenant_id=? AND event_id=?',
    guestId,
    e.tenant_id,
    e.id,
  );
  if (!g?.token_cipher) fail(404, 'Kode tamu tidak aktif.');
  const raw = await decrypt(
    g.token_cipher,
    env.GUEST_ENCRYPTION_KEY,
    `${e.tenant_id}:${e.id}:${g.id}`,
  );
  const url = new URL(`/i/${e.slug}`, env.PUBLIC_SITE_URL);
  url.searchParams.set('to', g.name);
  url.searchParams.set('code', raw);
  const content = JSON.parse(e.draft);
  const message = content.whatsappMessage
    .replaceAll('{nama}', g.name)
    .replaceAll('{link}', url.toString());
  return { url: url.toString(), message, whatsapp: g.phone ? whatsappUrl(g.phone, message) : null };
}
export async function rotateGuest(
  env: Env,
  a: Actor,
  e: EventRow,
  guestId: string,
  revoke = false,
) {
  const raw = token();
  const cipher = revoke
    ? null
    : await encrypt(raw, env.GUEST_ENCRYPTION_KEY, `${e.tenant_id}:${e.id}:${guestId}`);
  await atomic(
    env.DB,
    'SELECT EXISTS(SELECT 1 FROM guests WHERE id=? AND tenant_id=? AND event_id=?)',
    [guestId, e.tenant_id, e.id],
    [
      stmt(
        env.DB,
        'UPDATE guests SET token_hash=?,token_cipher=?,token_version=token_version+1 WHERE id=? AND tenant_id=? AND event_id=?',
        revoke ? null : await digest(raw),
        cipher,
        guestId,
        e.tenant_id,
        e.id,
      ),
      stmt(
        env.DB,
        'DELETE FROM guest_sessions WHERE guest_id=? AND tenant_id=? AND event_id=?',
        guestId,
        e.tenant_id,
        e.id,
      ),
      audit(env, a.id, revoke ? 'guest.revoke' : 'guest.rotate', e.tenant_id, e.id),
    ],
  );
  return { ok: true };
}
export const guestCookie = (eventId: string) => `celeyo_guest_${eventId.replaceAll('-', '')}`;
export async function openGuest(env: Env, request: Request, slug: string, raw: string) {
  const e = await publicEvent(env, slug);
  await rateLimit(
    env,
    `guest-open:${e.id}:${request.headers.get('CF-Connecting-IP') || 'local'}`,
    20,
  );
  const g = await one<Guest>(
    env.DB,
    'SELECT * FROM guests WHERE token_hash=? AND tenant_id=? AND event_id=?',
    await digest(raw),
    e.tenant_id,
    e.id,
  );
  if (!g) fail(403, 'Kode undangan tidak valid atau telah dicabut.');
  const session = token();
  await atomic(
    env.DB,
    'SELECT token_hash=? AND token_version=? FROM guests WHERE id=? AND event_id=?',
    [await digest(raw), g.token_version, g.id, e.id],
    [
      stmt(
        env.DB,
        'INSERT INTO guest_sessions VALUES(?,?,?,?,?,?)',
        await digest(session),
        e.tenant_id,
        e.id,
        g.id,
        g.token_version,
        now() + 7 * 86400000,
      ),
      stmt(
        env.DB,
        'UPDATE guests SET opened_at=coalesce(opened_at,?) WHERE id=? AND tenant_id=? AND event_id=?',
        now(),
        g.id,
        e.tenant_id,
        e.id,
      ),
    ],
  );
  return { event: e, guest: g, session };
}
export async function currentGuest(env: Env, request: Request, e: EventRow) {
  const cookie = request.headers
    .get('cookie')
    ?.split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith(guestCookie(e.id) + '='))
    ?.split('=')[1];
  if (!cookie) fail(403, 'Buka tautan personal Anda untuk mengirim ucapan.');
  const g = await one<Guest>(
    env.DB,
    'SELECT g.* FROM guests g JOIN guest_sessions s ON s.guest_id=g.id AND s.tenant_id=g.tenant_id AND s.event_id=g.event_id AND s.token_version=g.token_version WHERE s.digest=? AND s.expires_at>? AND g.tenant_id=? AND g.event_id=? AND g.token_hash IS NOT NULL',
    await digest(cookie),
    now(),
    e.tenant_id,
    e.id,
  );
  if (!g) fail(403, 'Sesi tamu berakhir. Buka kembali tautan personal Anda.');
  return g;
}
export const responseInput = z.object({
  attending: z.boolean(),
  party: z.number().int().min(0).max(20),
  message: z.string().trim().max(1000),
  version: z.number().int().min(0),
  website: z.string().max(0).default(''),
});
export async function respond(
  env: Env,
  request: Request,
  e: EventRow,
  g: Guest,
  input: z.infer<typeof responseInput>,
) {
  if (!e.responses_open) fail(403, 'Penerimaan RSVP dan ucapan sudah ditutup.');
  if (
    (input.attending && (input.party < 1 || input.party > g.max_party)) ||
    (!input.attending && input.party !== 0)
  )
    fail(400, 'Jumlah kehadiran tidak sesuai kuota undangan.');
  await rateLimit(env, `respond:${e.id}:${g.id}`, 6);
  await rateLimit(
    env,
    `respond-ip:${e.id}:${request.headers.get('CF-Connecting-IP') || 'local'}`,
    30,
  );
  const condition = `SELECT (SELECT responses_open FROM events WHERE id=?)=1 AND (SELECT token_version FROM guests WHERE id=? AND event_id=?)=? AND coalesce((SELECT version FROM responses WHERE guest_id=? AND event_id=?),0)=?`;
  await atomic(
    env.DB,
    condition,
    [e.id, g.id, e.id, g.token_version, g.id, e.id, input.version],
    [
      stmt(
        env.DB,
        `INSERT INTO responses(tenant_id,event_id,guest_id,attending,party,message,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(event_id,guest_id) DO UPDATE SET attending=excluded.attending,party=excluded.party,message=excluded.message,version=responses.version+1,updated_at=excluded.updated_at`,
        e.tenant_id,
        e.id,
        g.id,
        input.attending ? 1 : 0,
        input.party,
        input.message,
        now(),
      ),
    ],
  );
  return { version: input.version + 1 };
}
export async function exportGuests(env: Env, e: EventRow) {
  const rows = await all<Record<string, unknown>>(
    env.DB,
    'SELECT g.name,g.phone,g.group_name,g.max_party,r.attending,r.party,r.message FROM guests g LEFT JOIN responses r ON r.event_id=g.event_id AND r.guest_id=g.id WHERE g.tenant_id=? AND g.event_id=? ORDER BY g.created_at LIMIT 20000',
    e.tenant_id,
    e.id,
  );
  const keys = ['name', 'phone', 'group_name', 'max_party', 'attending', 'party', 'message'];
  return [keys.join(','), ...rows.map((r) => keys.map((k) => csvCell(r[k])).join(','))].join(
    '\r\n',
  );
}
export async function updateGuest(
  env: Env,
  a: Actor,
  e: EventRow,
  guestId: string,
  input: z.infer<typeof guestInput>,
) {
  editable(e);
  let phone: string;
  try {
    phone = normalizePhone(input.phone);
  } catch {
    fail(400, 'Nomor WhatsApp tidak valid.');
  }
  await atomic(
    env.DB,
    'SELECT EXISTS(SELECT 1 FROM guests WHERE id=? AND event_id=? AND tenant_id=?) AND coalesce((SELECT party FROM responses WHERE guest_id=? AND event_id=? AND tenant_id=?),0)<=?',
    [guestId, e.id, e.tenant_id, guestId, e.id, e.tenant_id, input.maxParty],
    [
      stmt(
        env.DB,
        'UPDATE guests SET name=?,phone=?,group_name=?,max_party=? WHERE id=? AND event_id=? AND tenant_id=?',
        input.name,
        phone,
        input.group,
        input.maxParty,
        guestId,
        e.id,
        e.tenant_id,
      ),
      audit(env, a.id, 'guest.edit', e.tenant_id, e.id),
    ],
  );
  return { ok: true };
}
