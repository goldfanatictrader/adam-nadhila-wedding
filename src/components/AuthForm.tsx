import { useEffect, useRef, useState } from 'react';
import { createAuthClient } from 'better-auth/react';
import { twoFactorClient } from 'better-auth/client/plugins';
const client = createAuthClient({ plugins: [twoFactorClient()] });
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}
export default function AuthForm({
  mode,
  sitekey = '',
}: {
  mode: 'login' | 'register' | 'reset' | 'account';
  sitekey?: string;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [two, setTwo] = useState(false),
    [backup, setBackup] = useState(false),
    [enrollment, setEnrollment] = useState<{ totpURI?: string; backupCodes?: string[] } | null>(
      null,
    );
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const captcha = useRef<HTMLDivElement>(null),
    widget = useRef(''),
    captchaToken = useRef('');
  useEffect(() => {
    if (!sitekey || mode === 'account') return;
    let disposed = false;
    const mount = () => {
      if (!disposed && captcha.current && window.turnstile)
        widget.current = window.turnstile.render(captcha.current, {
          sitekey,
          callback: (v: string) => (captchaToken.current = v),
          'expired-callback': () => (captchaToken.current = ''),
        });
    };
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = mount;
    document.head.appendChild(script);
    return () => {
      disposed = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      script.remove();
    };
  }, [sitekey, mode]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      let result: any;
      if (mode === 'account') {
        if (data.action === 'enable') {
          result = await client.twoFactor.enable({ password: String(data.password) });
          if (result.data) setEnrollment(result.data);
        } else if (data.action === 'verify') {
          result = await client.twoFactor.verifyTotp({ code: String(data.code) });
          if (!result.error) {
            setEnrollment(null);
            setMessage('Autentikasi dua langkah sudah aktif. Simpan kode pemulihan Anda.');
          }
        } else {
          result = await client.changePassword({
            currentPassword: String(data.currentPassword),
            newPassword: String(data.newPassword),
            revokeOtherSessions: true,
          });
          if (!result.error) setMessage('Password diperbarui dan sesi lain dicabut.');
        }
      } else if (two) {
        result = backup
          ? await client.twoFactor.verifyBackupCode({
              code: String(data.code),
              disableSession: false,
            })
          : await client.twoFactor.verifyTotp({ code: String(data.code), trustDevice: false });
        if (!result.error) window.location.href = '/app';
      } else if (mode === 'reset') {
        const token = new URLSearchParams(window.location.search).get('token');
        if (token) {
          result = await client.resetPassword({ newPassword: String(data.password), token });
          if (!result.error) setMessage('Password telah diperbarui. Silakan masuk kembali.');
        } else {
          result = await client.requestPasswordReset(
            { email: String(data.email), redirectTo: '/reset-password' },
            { headers: { 'x-turnstile-token': captchaToken.current } },
          );
          if (!result.error)
            setMessage('Jika akun terdaftar, tautan pemulihan akan dikirim ke email Anda.');
        }
      } else if (mode === 'register') {
        result = await client.signUp.email(
          {
            name: String(data.name),
            email: String(data.email),
            password: String(data.password),
            callbackURL: '/app',
          },
          { headers: { 'x-turnstile-token': captchaToken.current } },
        );
        if (!result.error) setMessage('Pendaftaran diterima. Buka email verifikasi sebelum masuk.');
      } else {
        result = await client.signIn.email(
          { email: String(data.email), password: String(data.password), callbackURL: '/app' },
          { headers: { 'x-turnstile-token': captchaToken.current } },
        );
        if (result.data?.twoFactorRedirect) setTwo(true);
        else if (!result.error) window.location.href = '/app';
      }
      if (result?.error) throw new Error(result.error.message || 'Permintaan gagal.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Permintaan gagal.');
    } finally {
      setBusy(false);
      if (widget.current) window.turnstile?.reset(widget.current);
      captchaToken.current = '';
    }
  }
  if (mode === 'account')
    return (
      <div className="stack">
        <section className="panel">
          <h2>Keamanan akun</h2>
          <p className="muted">Lindungi akun dengan authenticator dan password yang kuat.</p>
          {message && (
            <p className="message" role="status">
              {message}
            </p>
          )}
          {error && (
            <p className="message error" role="alert">
              {error}
            </p>
          )}
          {!enrollment ? (
            <form method="post" onSubmit={submit} className="stack">
              <input type="hidden" name="action" value="enable" />
              <label>
                Password saat ini
                <input name="password" type="password" autoComplete="current-password" required />
              </label>
              <button className="btn" disabled={busy || !ready}>
                Aktifkan authenticator
              </button>
            </form>
          ) : (
            <>
              <p>
                Tambahkan kunci berikut pada aplikasi authenticator Anda. Simpan kode pemulihan
                sebelum melanjutkan.
              </p>
              <p className="inline-code">
                Kunci: {new URL(enrollment.totpURI || 'https://invalid').searchParams.get('secret')}
              </p>
              <details>
                <summary>URI authenticator</summary>
                <p className="inline-code">{enrollment.totpURI}</p>
              </details>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{enrollment.backupCodes?.join('\n')}</pre>
              <form method="post" onSubmit={submit} className="stack">
                <input type="hidden" name="action" value="verify" />
                <label>
                  Kode authenticator
                  <input
                    name="code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    autoComplete="one-time-code"
                    required
                  />
                </label>
                <button className="btn" disabled={busy || !ready}>
                  Verifikasi & aktifkan
                </button>
              </form>
            </>
          )}
        </section>
        <section className="panel">
          <h3>Ganti password</h3>
          <form method="post" className="stack" onSubmit={submit}>
            <label>
              Password saat ini
              <input
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>
            <label>
              Password baru · minimal 12 karakter
              <input
                name="newPassword"
                type="password"
                minLength={12}
                required
                autoComplete="new-password"
              />
            </label>
            <button className="btn secondary" disabled={busy || !ready}>
              Simpan password
            </button>
          </form>
        </section>
        <button
          className="btn secondary"
          onClick={async () => {
            await client.signOut();
            window.location.href = '/login';
          }}
        >
          Keluar dari akun
        </button>
      </div>
    );
  const resetToken =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('token');
  return (
    <div className="auth-card">
      <span className="eyebrow">CREATE. INVITE. CELEBRATE.</span>
      <h1 style={{ marginTop: 18 }}>
        {two
          ? 'Satu langkah lagi.'
          : mode === 'register'
            ? 'Mulai cerita Anda.'
            : mode === 'reset'
              ? 'Kembali ke cerita Anda.'
              : 'Senang bertemu lagi.'}
      </h1>
      <p className="muted">
        {two
          ? 'Masukkan kode untuk menyelesaikan login.'
          : mode === 'register'
            ? 'Buat akun dan susun undangan pertama Anda.'
            : mode === 'reset'
              ? 'Atur ulang password akun CELEYO Anda.'
              : 'Masuk untuk melanjutkan undangan Anda.'}
      </p>
      {message && (
        <p role="status" className="message">
          {message}
        </p>
      )}
      {error && (
        <p id="auth-error" role="alert" className="message error">
          {error}
        </p>
      )}
      <form
        method="post"
        onSubmit={submit}
        className="stack"
        aria-describedby={error ? 'auth-error' : undefined}
        aria-busy={busy}
      >
        {two ? (
          <label>
            {backup ? 'Kode pemulihan' : 'Kode authenticator'}
            <input name="code" autoComplete="one-time-code" required />
          </label>
        ) : (
          <>
            {mode === 'register' && (
              <label>
                Nama Anda
                <input name="name" autoComplete="name" minLength={2} maxLength={100} required />
              </label>
            )}
            {!resetToken && (
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="nama@email.com"
                />
              </label>
            )}
            {(mode !== 'reset' || resetToken) && (
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={12}
                  required
                  placeholder="Minimal 12 karakter"
                />
              </label>
            )}
          </>
        )}
        <div ref={captcha} />
        <button className="btn full" disabled={busy || !ready}>
          {busy
            ? 'Memproses…'
            : two
              ? 'Verifikasi'
              : mode === 'register'
                ? 'Buat akun CELEYO ↗'
                : mode === 'reset'
                  ? 'Atur ulang password'
                  : 'Masuk ke CELEYO ↗'}
        </button>
      </form>
      {two && (
        <button className="quiet link" onClick={() => setBackup(!backup)}>
          {backup ? 'Gunakan authenticator' : 'Gunakan kode pemulihan'}
        </button>
      )}
      <p className="note" style={{ marginTop: 25, marginBottom: 0 }}>
        {mode === 'register' ? (
          <>
            Sudah punya akun?{' '}
            <a className="link" href="/login">
              Masuk
            </a>
          </>
        ) : (
          <>
            Belum punya akun?{' '}
            <a className="link" href="/register">
              Daftar gratis
            </a>
          </>
        )}
      </p>
      {mode === 'login' && (
        <p className="note">
          <a className="link" href="/reset-password">
            Lupa password?
          </a>
        </p>
      )}
    </div>
  );
}
