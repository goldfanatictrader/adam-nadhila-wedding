function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
}

/** Brand only the presentation; queue identity, message content and retry rules stay unchanged. */
export function brandedEmail(subject: string, body: string, siteUrl: string) {
  const origin = new URL(siteUrl).origin;
  const safeOrigin = escapeHtml(origin);
  // Link only platform URLs. Tenant-provided text is always escaped, never interpreted as HTML.
  const content = body
    .split(/(https?:\/\/[^\s<>"']+)/g)
    .map((part) => {
      try {
        const linkText = part.replace(/[.,)]+$/, '');
        const punctuation = part.slice(linkText.length);
        const url = new URL(linkText);
        if (url.origin === origin && /^https?:$/.test(url.protocol)) {
          return `<a href="${escapeHtml(url.href)}" style="color:#A64730;word-break:break-all">${escapeHtml(linkText)}</a>${escapeHtml(punctuation)}`;
        }
      } catch {
        /* Ordinary message text. */
      }
      return escapeHtml(part);
    })
    .join('')
    .replace(/\n/g, '<br />');
  return {
    text: `${body}\n\nCELEYO\nCreate. Invite. Celebrate.`,
    html: `<!doctype html><html lang="id"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:#FAF1E6;color:#142C22;font-family:Arial,sans-serif"><table role="presentation" style="width:100%;border-collapse:collapse"><tr><td align="center" style="padding:32px 16px"><table role="presentation" style="width:100%;max-width:560px;background:#FFFBF6;border:1px solid #DFD2C2;border-radius:18px"><tr><td style="padding:32px"><a href="${safeOrigin}/"><img src="${safeOrigin}/brand/logo-email.png" width="210" alt="CELEYO — beranda" style="display:block;max-width:100%;height:auto;border:0" /></a><h1 style="font-family:Georgia,serif;font-weight:400;font-size:28px;line-height:1.25;margin:32px 0 20px">${escapeHtml(subject)}</h1><div style="font-size:16px;line-height:1.65;overflow-wrap:anywhere">${content}</div><p style="font-size:13px;color:#615D50;border-top:1px solid #DFD2C2;padding-top:24px;margin-top:32px">CELEYO<br />Create. Invite. Celebrate.</p></td></tr></table></td></tr></table></body></html>`,
  };
}
