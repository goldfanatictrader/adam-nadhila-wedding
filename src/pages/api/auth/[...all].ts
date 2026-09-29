import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { Env } from '../../../lib/types';
import { auth } from '../../../lib/server/auth';
import { rateLimit, turnstile, originCheck } from '../../../lib/server/security';
import { errorResponse, bounded } from '../../../lib/server/http';
export const ALL: APIRoute = async ({ request }) => {
  const bindings = env as unknown as Env;
  try {
    originCheck(bindings, request);
    await rateLimit(
      bindings,
      `auth:${request.headers.get('CF-Connecting-IP') || 'local'}`,
      30,
      60_000,
    );
    if (
      request.method === 'POST' &&
      /\/(sign-up\/email|sign-in\/email|request-password-reset)$/.test(
        new URL(request.url).pathname,
      )
    ) {
      await turnstile(bindings, request.headers.get('x-turnstile-token') || '', request);
    }
    let authRequest = request;
    if (request.method === 'POST') {
      const bytes = await bounded(request, 16000);
      try {
        const payload = JSON.parse(new TextDecoder().decode(bytes));
        if (typeof payload.email === 'string')
          await rateLimit(
            bindings,
            `auth-account:${payload.email.toLowerCase().trim()}`,
            10,
            60000,
          );
      } catch (error) {
        if (error instanceof Error && 'status' in error) throw error;
      }
      authRequest = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: bytes,
      });
    }
    return await auth(bindings, request).handler(authRequest);
  } catch (e) {
    return errorResponse(e);
  }
};
