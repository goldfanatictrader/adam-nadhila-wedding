import { describe, expect, it } from 'vitest';
import { brandedEmail } from '../src/lib/server/email-brand';

describe('transactional email branding', () => {
  it('preserves the plain-text message and usable verification link in HTML', () => {
    const url = 'https://celeyo.com/api/auth/verify-email?token=demo&callbackURL=%2Fapp';
    const body = `Verifikasi alamat email Anda:\n${url}`;
    const mail = brandedEmail('Verifikasi email CELEYO', body, 'https://celeyo.com');
    expect(mail.text).toBe(`${body}\n\nCELEYO\nCreate. Invite. Celebrate.`);
    expect(mail.html).toContain('token=demo&amp;callbackURL=%2Fapp');
    expect(mail.html).toContain('https://celeyo.com/brand/logo-email.png');
    expect(mail.html).not.toContain('fonts.googleapis.com');
    const reminder = brandedEmail(
      'Masa aktif undangan',
      'Buka https://celeyo.com/app.',
      'https://celeyo.com',
    );
    expect(reminder.html).toContain('href="https://celeyo.com/app"');
    expect(reminder.html).toContain('https://celeyo.com/app</a>.');
  });
  it('escapes tenant content and never turns external URLs or markup into active content', () => {
    const mail = brandedEmail(
      '<img src=x onerror=alert(1)>',
      'A & B 🤍\n<script>evil()</script> https://evil.test/pay "test"',
      'https://celeyo.com',
    );
    expect(mail.html).toContain('&lt;script&gt;evil()&lt;/script&gt;');
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).not.toContain('href="https://evil.test');
    expect(mail.html).toContain('A &amp; B 🤍');
    expect(mail.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});
