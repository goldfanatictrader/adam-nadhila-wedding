import { imageSize } from 'image-size';
import type { Env, Actor, EventRow } from '../types';
import { all, one, stmt, atomic, audit, id, now } from './db';
import { fail, bounded } from './http';
import { editable, publicActive } from './events';
import { accessEvent } from './auth';
export type MediaRow = {
  id: string;
  tenant_id: string;
  event_id: string;
  object_key: string;
  mime: string;
  size: number;
  status: string;
  filename: string;
  kind: string;
  alt: string;
};
export function validateMedia(data: Uint8Array) {
  let mime = '',
    kind = 'image';
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) mime = 'image/jpeg';
  else if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => data[i] === v)) mime = 'image/png';
  else if (
    new TextDecoder().decode(data.slice(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(data.slice(8, 12)) === 'WEBP'
  )
    mime = 'image/webp';
  else if (
    new TextDecoder().decode(data.slice(0, 3)) === 'ID3' ||
    (data[0] === 0xff && (data[1] & 0xe0) === 0xe0)
  ) {
    mime = 'audio/mpeg';
    kind = 'audio';
  }
  if (!mime) fail(415, 'Gunakan JPEG, PNG, WebP, atau MP3.');
  if (data.length > (kind === 'image' ? 10 : 20) * 1024 * 1024)
    fail(413, 'Foto maksimal 10 MiB, audio maksimal 20 MiB.');
  if (kind === 'image') {
    try {
      const { width, height } = imageSize(data);
      if (!width || !height || width * height > 25_000_000)
        fail(400, 'Foto maksimal 25 megapiksel.');
    } catch {
      fail(400, 'Gambar rusak atau melebihi 25 megapiksel.');
    }
  }
  return { mime, kind };
}
export async function uploadMedia(env: Env, a: Actor, e: EventRow, request: Request) {
  editable(e);
  const data = await bounded(request, 20 * 1024 * 1024);
  const { mime, kind } = validateMedia(data);
  const assetId = id(),
    objectKey = `${e.tenant_id}/${e.id}/${assetId}`,
    stamp = now();
  const filename = (request.headers.get('x-file-name') || 'media')
    .slice(0, 150)
    .replace(/[^a-zA-Z0-9._ -]/g, '_');
  const checksum = [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
  await atomic(
    env.DB,
    `SELECT (SELECT coalesce(sum(size),0) FROM media_assets WHERE tenant_id=? AND event_id=?)+?<=media_limit AND (?!='image' OR (SELECT count(*) FROM media_assets WHERE tenant_id=? AND event_id=? AND kind='image')<photo_limit) AND status NOT IN ('suspended','deleted') FROM events WHERE id=? AND tenant_id=?`,
    [e.tenant_id, e.id, data.length, kind, e.tenant_id, e.id, e.id, e.tenant_id],
    [
      stmt(
        env.DB,
        'INSERT INTO media_assets(id,tenant_id,event_id,object_key,filename,mime,size,kind,created_at,checksum) VALUES(?,?,?,?,?,?,?,?,?,?)',
        assetId,
        e.tenant_id,
        e.id,
        objectKey,
        filename,
        mime,
        data.length,
        kind,
        stamp,
        checksum,
      ),
    ],
  );
  try {
    await env.MEDIA.put(objectKey, data, { httpMetadata: { contentType: mime } });
    await stmt(
      env.DB,
      "UPDATE media_assets SET status='ready' WHERE id=? AND tenant_id=? AND event_id=? AND status='pending'",
      assetId,
      e.tenant_id,
      e.id,
    ).run();
  } catch (error) {
    await env.MEDIA.delete(objectKey);
    await stmt(
      env.DB,
      'DELETE FROM media_assets WHERE id=? AND tenant_id=? AND event_id=?',
      assetId,
      e.tenant_id,
      e.id,
    ).run();
    throw error;
  }
  return { id: assetId, mime, size: data.length, kind };
}
export async function deleteMedia(env: Env, a: Actor, e: EventRow, assetId: string) {
  editable(e);
  const asset = await one<MediaRow>(
    env.DB,
    'SELECT * FROM media_assets WHERE id=? AND tenant_id=? AND event_id=?',
    assetId,
    e.tenant_id,
    e.id,
  );
  if (!asset) fail(404, 'Aset tidak ditemukan.');
  await atomic(
    env.DB,
    'SELECT NOT EXISTS(SELECT 1 FROM media_refs WHERE tenant_id=? AND event_id=? AND asset_id=?)',
    [e.tenant_id, e.id, asset.id],
    [
      stmt(
        env.DB,
        "UPDATE media_assets SET status='deleting' WHERE id=? AND tenant_id=? AND event_id=?",
        asset.id,
        e.tenant_id,
        e.id,
      ),
      audit(env, a.id, 'media.delete', e.tenant_id, e.id),
    ],
  );
  await env.MEDIA.delete(asset.object_key);
  await stmt(
    env.DB,
    'DELETE FROM media_assets WHERE id=? AND tenant_id=? AND event_id=?',
    asset.id,
    e.tenant_id,
    e.id,
  ).run();
  return { ok: true };
}
export async function serveMedia(env: Env, request: Request, assetId: string, a?: Actor) {
  const m = await one<MediaRow>(
    env.DB,
    "SELECT * FROM media_assets WHERE id=? AND status='ready'",
    assetId,
  );
  if (!m) fail(404, 'Aset tidak ditemukan.');
  const e = await one<EventRow>(
    env.DB,
    "SELECT e.* FROM events e JOIN tenants t ON t.id=e.tenant_id WHERE e.id=? AND e.tenant_id=? AND t.status='active'",
    m.event_id,
    m.tenant_id,
  );
  const ref = await one(
    env.DB,
    "SELECT asset_id FROM media_refs WHERE tenant_id=? AND event_id=? AND asset_id=? AND state='published'",
    m.tenant_id,
    m.event_id,
    m.id,
  );
  const visible = e && publicActive(e) && ref;
  if (!visible) {
    if (!a) fail(404, 'Aset tidak ditemukan.');
    await accessEvent(env, a, m.event_id);
  }
  const head = await env.MEDIA.head(m.object_key);
  if (!head) fail(404, 'File tidak ditemukan.');
  const headers = new Headers({
    'Content-Type': m.mime,
    'Content-Length': String(head.size),
    ETag: head.httpEtag,
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  });
  if (request.headers.get('If-None-Match') === head.httpEtag)
    return new Response(null, { status: 304, headers });
  const range = request.headers.get('Range');
  let spec: { offset: number; length: number } | undefined;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2]))
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${head.size}` },
      });
    const offset = match[1] ? Number(match[1]) : Math.max(0, head.size - Number(match[2]));
    const end = match[1]
      ? match[2]
        ? Math.min(Number(match[2]), head.size - 1)
        : head.size - 1
      : head.size - 1;
    if (!Number.isSafeInteger(offset) || offset >= head.size || end < offset)
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${head.size}` },
      });
    spec = { offset, length: end - offset + 1 };
    headers.set('Content-Range', `bytes ${offset}-${end}/${head.size}`);
    headers.set('Content-Length', String(spec.length));
  }
  if (request.method === 'HEAD') return new Response(null, { status: spec ? 206 : 200, headers });
  const object = await env.MEDIA.get(m.object_key, spec ? { range: spec } : undefined);
  if (!object) fail(404, 'File tidak ditemukan.');
  return new Response(object.body, { status: spec ? 206 : 200, headers });
}
export async function listMedia(env: Env, e: EventRow) {
  return all(
    env.DB,
    "SELECT id,filename,mime,size,kind,alt,focal_x,focal_y FROM media_assets WHERE tenant_id=? AND event_id=? AND status='ready' ORDER BY created_at DESC LIMIT 100",
    e.tenant_id,
    e.id,
  );
}
