import { defineMiddleware } from 'astro:middleware';
export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  const headers = new Headers(response.headers);
  const nonce = btoa(crypto.randomUUID());
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://challenges.cloudflare.com ${import.meta.env.DEV ? 'ws: wss:' : ''}; frame-src 'self' https://www.youtube-nocookie.com https://challenges.cloudflare.com; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'`,
  );
  headers.set('Cache-Control', 'no-store');
  if (
    /^\/(app|superadmin|api|login|register|account)/.test(context.url.pathname) ||
    context.url.searchParams.has('code') ||
    context.url.searchParams.has('to') ||
    context.url.searchParams.has('guest')
  )
    headers.set('X-Robots-Tag', 'noindex, nofollow');
  if (context.url.protocol === 'https:')
    headers.set('Strict-Transport-Security', 'max-age=31536000');
  const secured = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  if (headers.get('Content-Type')?.includes('text/html'))
    return new HTMLRewriter()
      .on('script', {
        element(el) {
          el.setAttribute('nonce', nonce);
        },
      })
      .transform(secured);
  return secured;
});
