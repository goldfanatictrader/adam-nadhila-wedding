import type { Env } from '../types';
import { fingerprint } from './crypto';
import { one, stmt } from './db';
import { fail } from './http';
export async function rateLimit(env: Env, key: string, limit = 60, window = 60_000) {
  const bucket = Math.floor(Date.now() / window);
  const hash = await fingerprint(`${bucket}:${key}`, env.RATE_LIMIT_SECRET);
  const result = await one<{ count: number }>(
    env.DB,
    'INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',
    hash,
    (bucket + 1) * window,
  );
  if (!result || result.count > limit) fail(429, 'Terlalu banyak percobaan. Tunggu sebentar.');
}
export async function turnstile(env: Env, value: string, request: Request) {
  if (env.APP_ENV === 'local') return;
  if (!env.TURNSTILE_SECRET_KEY || !value) fail(400, 'Selesaikan pemeriksaan keamanan.');
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: value,
      remoteip: request.headers.get('CF-Connecting-IP') || '',
    }),
  });
  const result = (await response.json()) as { success: boolean; hostname: string };
  if (!result.success || result.hostname !== new URL(env.PUBLIC_SITE_URL).hostname)
    fail(400, 'Pemeriksaan keamanan gagal. Ulangi kembali.');
}
export function originCheck(env: Env, request: Request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  const origin = request.headers.get('Origin');
  if (
    ![
      new URL(env.PUBLIC_SITE_URL).origin,
      ...(env.APP_ENV === 'local' ? ['http://localhost:4321', 'http://127.0.0.1:4321'] : []),
    ].includes(origin || '')
  )
    fail(403, 'Asal permintaan tidak diizinkan.');
}
export async function queueEmail(
  env: Env,
  to: string,
  subject: string,
  text: string,
  key = crypto.randomUUID(),
) {
  await stmt(
    env.DB,
    'INSERT OR IGNORE INTO outbox(id,recipient,subject,body,next_at) VALUES(?,?,?,?,?)',
    key,
    to,
    subject,
    text,
    Date.now(),
  ).run();
  if (env.APP_ENV !== 'local' && env.EMAIL) {
    try {
      await env.EMAIL.send({ to, from: env.EMAIL_FROM, subject, text });
      await stmt(
        env.DB,
        "UPDATE outbox SET status='sent',sent_at=? WHERE id=?",
        Date.now(),
        key,
      ).run();
    } catch {
      /* Cron retries without recreating auth or payment state. */
    }
  }
}
