import { betterAuth } from 'better-auth';
import { twoFactor } from 'better-auth/plugins';
import type { Actor, Env, EventRow } from '../types';
import { one, stmt, id, now } from './db';
import { fail } from './http';
import { queueEmail } from './security';
export function auth(env: Env, request?: Request) {
  const localOrigins =
    env.APP_ENV === 'local' ? ['http://localhost:4321', 'http://127.0.0.1:4321'] : [];
  const requestOrigin =
    request?.headers.get('Origin') || (request ? new URL(request.url).origin : '');
  const baseURL = localOrigins.includes(requestOrigin) ? requestOrigin : env.BETTER_AUTH_URL;
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32)
    throw new Error('Configure BETTER_AUTH_SECRET');
  return betterAuth({
    appName: 'CELEYO',
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL,
    trustedOrigins: [env.PUBLIC_SITE_URL, ...localOrigins],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await queueEmail(
          env,
          user.email,
          'Atur ulang password CELEYO',
          `Buka tautan berikut untuk mengatur ulang password Anda:\n${url}\nAbaikan bila Anda tidak meminta perubahan ini.`,
        );
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await queueEmail(
          env,
          user.email,
          'Verifikasi email CELEYO',
          `Selamat datang di CELEYO. Verifikasi alamat email Anda:\n${url}`,
        );
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 7, freshAge: 60 * 5, cookieCache: { enabled: false } },
    advanced: {
      useSecureCookies: env.APP_ENV !== 'local',
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
    },
    plugins: [twoFactor({ issuer: 'CELEYO' })],
    rateLimit: { enabled: false }, // Persistent D1 limiter wraps every auth route, including verification.
  });
}
export async function actor(env: Env, request: Request): Promise<Actor> {
  const session = await auth(env, request).api.getSession({ headers: request.headers });
  if (!session) fail(401, 'Silakan masuk terlebih dahulu.');
  if (!session.user.emailVerified) fail(403, 'Verifikasi email Anda terlebih dahulu.');
  const operator = await one(
    env.DB,
    'SELECT user_id FROM operators WHERE user_id=?',
    session.user.id,
  );
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    verified: session.user.emailVerified,
    admin: !!operator,
    mfa: !!session.user.twoFactorEnabled,
    sessionId: session.session.id,
  };
}
export async function workspace(env: Env, a: Actor) {
  await stmt(
    env.DB,
    'INSERT OR IGNORE INTO tenants(id,owner_id,created_at) VALUES(?,?,?)',
    id(),
    a.id,
    now(),
  ).run();
  const t = await one<{ id: string; status: string; trial_used: number }>(
    env.DB,
    'SELECT * FROM tenants WHERE owner_id=?',
    a.id,
  );
  if (!t || t.status !== 'active') fail(403, 'Akun sedang dibatasi. Hubungi dukungan CELEYO.');
  return t;
}
export async function accessEvent(
  env: Env,
  a: Actor,
  eventId: string,
  ownerOnly = false,
): Promise<EventRow> {
  const e = await one<EventRow>(
    env.DB,
    `SELECT e.* FROM events e JOIN tenants t ON t.id=e.tenant_id WHERE e.id=? AND e.status!='deleted' AND t.status='active' AND (e.owner_id=? ${ownerOnly ? '' : 'OR EXISTS(SELECT 1 FROM event_members m WHERE m.event_id=e.id AND m.tenant_id=e.tenant_id AND m.user_id=?) OR EXISTS(SELECT 1 FROM support_access s WHERE s.event_id=e.id AND s.tenant_id=e.tenant_id AND s.operator_id=? AND s.expires_at>?)'})`,
    eventId,
    a.id,
    ...(ownerOnly ? [] : [a.id, a.id, now()]),
  );
  if (!e) fail(404, 'Undangan tidak ditemukan.');
  return e;
}
export async function requireAdmin(env: Env, a: Actor) {
  if (!a.admin) fail(403, 'Akses tidak diizinkan.');
  if (!a.mfa) fail(403, 'Aktifkan autentikasi dua langkah pada halaman Akun.');
  const elevated = await one(
    env.DB,
    'SELECT session_id FROM admin_elevations WHERE session_id=? AND expires_at>?',
    a.sessionId,
    now(),
  );
  if (!elevated)
    fail(403, 'Verifikasi ulang password dan kode authenticator untuk membuka superadmin.');
}
