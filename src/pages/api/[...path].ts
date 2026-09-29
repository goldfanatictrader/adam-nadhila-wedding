import type { APIRoute } from 'astro';
import { env as bindings } from 'cloudflare:workers';
import { z } from 'zod';
import type { Env, EventRow } from '../../lib/types';
import { actor, auth, accessEvent, requireAdmin } from '../../lib/server/auth';
import { json, body, fail, errorResponse } from '../../lib/server/http';
import { all, one, stmt, atomic, audit, id, now } from '../../lib/server/db';
import { originCheck, rateLimit } from '../../lib/server/security';
import { templates, plans, addons } from '../../lib/catalog';
import { contentSchema } from '../../lib/content';
import {
  createEvent,
  listEvents,
  eventDetail,
  saveEvent,
  publishEvent,
  deleteEvent,
  addEditor,
  publicEvent,
  createSchema,
  saveSchema,
} from '../../lib/server/events';
import {
  addGuests,
  updateGuest,
  listGuests,
  guestLink,
  rotateGuest,
  openGuest,
  guestCookie,
  currentGuest,
  respond,
  exportGuests,
  guestInput,
  responseInput,
} from '../../lib/server/guests';
import {
  manualGrant,
  grantInput,
  createInvoice,
  claimInvoice,
  listInvoices,
  approveInvoice,
  refundInvoice,
  business,
  businessSchema,
  priceBook,
  invoiceInput,
  approvalInput,
} from '../../lib/server/billing';
import { uploadMedia, deleteMedia, listMedia, serveMedia } from '../../lib/server/media';
import { compose, composeInput, applyProposal } from '../../lib/server/ai';
const identifier = z.string().min(1).max(100);
const pageOf = (url: URL) => Math.max(1, Math.min(400, Number(url.searchParams.get('page')) || 1));
export const ALL: APIRoute = async ({ request, params }) => {
  const env = bindings as unknown as Env;
  const url = new URL(request.url);
  const path = (params.path || '').split('/');
  const method = request.method;
  try {
    originCheck(env, request);
    if (path[0] === 'health') {
      await one(env.DB, 'SELECT count(*) AS ready FROM price_versions');
      if (
        env.APP_ENV !== 'local' &&
        (!env.BETTER_AUTH_SECRET ||
          !env.GUEST_ENCRYPTION_KEY ||
          !env.TURNSTILE_SECRET_KEY ||
          !env.EMAIL)
      )
        return json({ ok: false, service: 'CELEYO' }, 503);
      return json({ ok: true, service: 'CELEYO' });
    }
    if (path[0] === 'catalog' && method === 'GET')
      return json({
        templates: await all(env.DB, 'SELECT * FROM catalog_templates WHERE available=1'),
        prices: await priceBook(env),
      });
    if (path[0] === 'invitations') {
      const e = await publicEvent(env, path[1]);
      if (path[2] === 'wishes' && method === 'GET')
        return json(
          await all(
            env.DB,
            "SELECT g.name,r.message,r.updated_at FROM responses r JOIN guests g ON g.id=r.guest_id AND g.tenant_id=r.tenant_id AND g.event_id=r.event_id WHERE r.tenant_id=? AND r.event_id=? AND r.hidden=0 AND r.message!='' ORDER BY r.updated_at DESC LIMIT 20 OFFSET ?",
            e.tenant_id,
            e.id,
            (pageOf(url) - 1) * 20,
          ),
        );
      if (path[2] === 'open' && method === 'POST') {
        const input = await body(request, z.object({ code: z.string().regex(/^[a-f0-9]{64}$/) }));
        const opened = await openGuest(env, request, path[1], input.code);
        return json({ name: opened.guest.name, maxParty: opened.guest.max_party }, 200, {
          'Set-Cookie': `${guestCookie(e.id)}=${opened.session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${env.APP_ENV === 'local' ? '' : '; Secure'}`,
        });
      }
      const g = await currentGuest(env, request, e);
      if (path[2] === 'response' && method === 'GET')
        return json({
          name: g.name,
          maxParty: g.max_party,
          response: await one(
            env.DB,
            'SELECT attending,party,message,version FROM responses WHERE tenant_id=? AND event_id=? AND guest_id=?',
            e.tenant_id,
            e.id,
            g.id,
          ),
        });
      if (path[2] === 'response' && method === 'POST')
        return json(await respond(env, request, e, g, await body(request, responseInput)));
      fail(404, 'Halaman tidak ditemukan.');
    }
    if (path[0] === 'media' && ['GET', 'HEAD'].includes(method)) {
      let a;
      try {
        a = await actor(env, request);
      } catch {}
      return await serveMedia(env, request, path[1], a);
    }
    const a = await actor(env, request);
    await rateLimit(env, `api:${a.id}`, 180);
    if (path[0] === 'me' && method === 'GET')
      return json({ id: a.id, email: a.email, name: a.name, admin: a.admin, mfa: a.mfa });
    if (path[0] === 'admin' && path[1] === 'elevate' && method === 'POST') {
      if (!a.admin || !a.mfa) fail(403, 'Akun superadmin dengan TOTP aktif diperlukan.');
      await rateLimit(env, `elevate:${a.id}`, 5, 300000);
      const input = await body(
        request,
        z.object({ password: z.string().max(200), code: z.string().regex(/^\d{6}$/) }),
      );
      await auth(env).api.verifyPassword({
        headers: request.headers,
        body: { password: input.password },
      });
      await auth(env).api.verifyTOTP({
        headers: request.headers,
        body: { code: input.code, trustDevice: false },
      });
      await stmt(
        env.DB,
        'INSERT INTO admin_elevations VALUES(?,?) ON CONFLICT(session_id) DO UPDATE SET expires_at=excluded.expires_at',
        a.sessionId,
        now() + 5 * 60000,
      ).run();
      return json({ ok: true });
    }
    if (path[0] === 'admin') {
      await requireAdmin(env, a);
      if (method === 'GET' && path.length === 1)
        return json({
          metrics: await one(
            env.DB,
            "SELECT (SELECT coalesce(sum(total),0) FROM invoices WHERE status='paid') revenue,(SELECT count(*) FROM invoices WHERE status='pending_review') reviews,(SELECT count(*) FROM events WHERE plan IS NOT NULL AND status='published' AND expires_at>?) active,(SELECT count(*) FROM tenants) tenants,(SELECT coalesce(sum(cost_micro_usd),0) FROM ai_runs WHERE created_at>?) aiCost",
            now(),
            now() - 30 * 86400000,
          ),
          invoices: await all(
            env.DB,
            'SELECT i.*,e.title FROM invoices i JOIN events e ON e.id=i.event_id ORDER BY i.created_at DESC LIMIT 50 OFFSET ?',
            (pageOf(url) - 1) * 50,
          ),
          events: await all(
            env.DB,
            'SELECT e.id,e.title,e.slug,e.status,e.plan,e.tenant_id,t.status AS tenant_status FROM events e JOIN tenants t ON t.id=e.tenant_id ORDER BY e.created_at DESC LIMIT 50 OFFSET ?',
            (pageOf(url) - 1) * 50,
          ),
          tickets: await all(
            env.DB,
            'SELECT s.*,e.title FROM setup_tickets s JOIN events e ON e.id=s.event_id ORDER BY s.created_at DESC LIMIT 50',
          ),
          templates: await all(env.DB, 'SELECT * FROM catalog_templates'),
          prices: await priceBook(env),
          business: await business(env),
          retentionDays:
            Number(
              (
                await one<{ value: string }>(
                  env.DB,
                  "SELECT value FROM settings WHERE key='billing_retention_days'",
                )
              )?.value,
            ) || null,
          aiDisabled: !!(await one(
            env.DB,
            "SELECT key FROM settings WHERE key='ai_disabled' AND value='true'",
          )),
          audit: await all(
            env.DB,
            'SELECT action,actor_id,created_at,event_id FROM audit_events ORDER BY created_at DESC LIMIT 30',
          ),
        });
      if (path[1] === 'billing' && method === 'PUT') {
        const input = await body(request, businessSchema);
        await env.DB.batch([
          stmt(
            env.DB,
            "INSERT INTO settings VALUES('billing',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
            JSON.stringify(input),
            now(),
          ),
          audit(env, a.id, 'billing.configure'),
        ]);
        return json({ ok: true });
      }
      if (path[1] === 'retention' && method === 'PUT') {
        const input = await body(request, z.object({ days: z.number().int().min(30).max(3650) }));
        await env.DB.batch([
          stmt(
            env.DB,
            "INSERT INTO settings VALUES('billing_retention_days',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
            String(input.days),
            now(),
          ),
          audit(env, a.id, 'retention.configure'),
        ]);
        return json({ ok: true });
      }
      if (path[1] === 'ai' && method === 'PUT') {
        const input = await body(request, z.object({ disabled: z.boolean() }));
        await env.DB.batch([
          stmt(
            env.DB,
            "INSERT INTO settings VALUES('ai_disabled',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
            String(input.disabled),
            now(),
          ),
          audit(env, a.id, 'ai.toggle'),
        ]);
        return json({ ok: true });
      }
      if (path[1] === 'templates' && method === 'PUT') {
        const input = await body(
          request,
          z.object({
            id: createSchema.shape.templateId,
            available: z.boolean(),
            name: z.string().min(2).max(80),
            description: z.string().max(500),
          }),
        );
        await env.DB.batch([
          stmt(
            env.DB,
            'UPDATE catalog_templates SET available=?,name=?,description=? WHERE id=?',
            input.available ? 1 : 0,
            input.name,
            input.description,
            input.id,
          ),
          audit(env, a.id, 'template.configure', null, null, input.id),
        ]);
        return json({ ok: true });
      }
      if (path[1] === 'prices' && method === 'PUT') {
        const tier = z.object({
          price: z.number().int().min(1000),
          guests: z.number().int().min(1).max(10000),
          photos: z.number().int().min(1).max(40),
          media: z.number().int().min(1000000).max(1000000000),
          ai: z.number().int().min(0).max(1000),
        });
        const input = await body(
          request,
          z.object({ starter: tier, premium: tier, signature: tier }),
        );
        if (
          input.starter.price >= input.premium.price ||
          input.premium.price >= input.signature.price ||
          input.starter.ai > input.premium.ai ||
          input.premium.ai > input.signature.ai
        )
          fail(400, 'Harga dan alokasi AI harus naik sesuai tier.');
        const book = Object.fromEntries(
          Object.entries(input).map(([k, v]) => [k, { ...plans[k as keyof typeof plans], ...v }]),
        );
        await env.DB.batch([
          stmt(env.DB, 'UPDATE price_versions SET active=0'),
          stmt(
            env.DB,
            'INSERT INTO price_versions VALUES(?,?,1,?)',
            id(),
            JSON.stringify({ plans: book, addons }),
            now(),
          ),
          audit(env, a.id, 'price.version'),
        ]);
        return json({ ok: true });
      }
      if (path[1] === 'invoices' && method === 'POST') {
        if (path[3] === 'approve')
          return json(await approveInvoice(env, a, path[2], await body(request, approvalInput)));
        if (path[3] === 'refund')
          return json(
            await refundInvoice(
              env,
              a,
              path[2],
              await body(
                request,
                z.object({
                  amount: z.number().int().positive(),
                  bankReference: z.string().min(5).max(200),
                  reason: z.string().min(10).max(1000),
                }),
              ),
            ),
          );
        if (path[3] === 'review') {
          const input = await body(
            request,
            z.object({
              status: z.enum(['pending_review', 'needs_clarification', 'cancelled']),
              note: z.string().min(10).max(500),
            }),
          );
          await atomic(
            env.DB,
            "SELECT status NOT IN ('paid','refunded') FROM invoices WHERE id=?",
            [path[2]],
            [
              stmt(
                env.DB,
                'UPDATE invoices SET status=?,review_note=? WHERE id=?',
                input.status,
                input.note,
                path[2],
              ),
              audit(env, a.id, 'payment.review', null, null, path[2]),
            ],
          );
          return json({ ok: true });
        }
      }
      if (path[1] === 'events' && path[3] === 'grant' && method === 'POST')
        return json(await manualGrant(env, a, path[2], await body(request, grantInput)));
      if (path[1] === 'events' && method === 'POST') {
        const input = await body(
          request,
          z.object({ status: z.enum(['draft', 'suspended']), reason: z.string().min(10).max(500) }),
        );
        await env.DB.batch([
          stmt(
            env.DB,
            "UPDATE events SET status=? WHERE id=? AND status!='deleted'",
            input.status,
            path[2],
          ),
          audit(env, a.id, 'event.status', null, path[2], input.reason),
        ]);
        return json({ ok: true });
      }
      if (path[1] === 'tenants' && method === 'POST') {
        const input = await body(
          request,
          z.object({
            status: z.enum(['active', 'suspended']),
            reason: z.string().min(10).max(500),
          }),
        );
        await env.DB.batch([
          stmt(env.DB, 'UPDATE tenants SET status=? WHERE id=?', input.status, path[2]),
          audit(env, a.id, 'tenant.status', path[2], null, input.reason),
        ]);
        return json({ ok: true });
      }
      if (path[1] === 'tickets' && method === 'POST') {
        const input = await body(
          request,
          z.object({
            action: z.enum(['open', 'revision', 'complete']),
            reason: z.string().min(10).max(500),
          }),
        );
        const t = await one<{
          id: string;
          tenant_id: string;
          event_id: string;
          access_until: number;
          revisions: number;
        }>(env.DB, "SELECT * FROM setup_tickets WHERE id=? AND status!='completed'", path[2]);
        if (!t) fail(404, 'Tiket tidak ditemukan.');
        if (input.action === 'open') {
          if (!t.access_until || t.access_until < now())
            fail(403, 'Klien belum mengizinkan akses atau izin berakhir.');
          await env.DB.batch([
            stmt(
              env.DB,
              'INSERT INTO support_access VALUES(?,?,?,?,?,?,?)',
              id(),
              t.tenant_id,
              t.event_id,
              a.id,
              input.reason,
              Math.min(now() + 12 * 3600000, t.access_until),
              now(),
            ),
            stmt(env.DB, "UPDATE setup_tickets SET status='in_progress' WHERE id=?", t.id),
            audit(env, a.id, 'support.open', t.tenant_id, t.event_id, input.reason),
          ]);
        } else if (input.action === 'revision')
          await stmt(
            env.DB,
            'UPDATE setup_tickets SET revisions=revisions+1 WHERE id=?',
            t.id,
          ).run();
        else
          await env.DB.batch([
            stmt(
              env.DB,
              "UPDATE setup_tickets SET status='completed',access_until=NULL WHERE id=?",
              t.id,
            ),
            stmt(
              env.DB,
              'DELETE FROM support_access WHERE event_id=? AND tenant_id=?',
              t.event_id,
              t.tenant_id,
            ),
            audit(env, a.id, 'support.complete', t.tenant_id, t.event_id),
          ]);
        return json({ eventId: t.event_id });
      }
      fail(404, 'Aksi tidak ditemukan.');
    }
    if (path[0] === 'events') {
      if (path.length === 1 && method === 'GET') return json(await listEvents(env, a));
      if (path.length === 1 && method === 'POST')
        return json(await createEvent(env, a, await body(request, createSchema)), 201);
      const ownerOnly =
        ['invoices', 'editors', 'tickets', 'delete', 'publish', 'unpublish'].includes(path[2]) ||
        (method === 'DELETE' && path.length === 2);
      const e = await accessEvent(env, a, path[1], ownerOnly);
      if (path.length === 2 && method === 'GET') return json(await eventDetail(env, a, e.id));
      if (path.length === 2 && method === 'PUT')
        return json(await saveEvent(env, a, e, await body(request, saveSchema)));
      if (path.length === 2 && method === 'DELETE') return json(await deleteEvent(env, a, e));
      if (path[2] === 'publish' && method === 'POST')
        return json(
          await publishEvent(
            env,
            a,
            e,
            (await body(request, z.object({ version: z.number().int().positive() }))).version,
          ),
        );
      if (path[2] === 'unpublish' && method === 'POST') {
        await env.DB.batch([
          stmt(
            env.DB,
            "UPDATE events SET status='draft' WHERE id=? AND tenant_id=? AND status='published'",
            e.id,
            e.tenant_id,
          ),
          audit(env, a.id, 'event.unpublish', e.tenant_id, e.id),
        ]);
        return json({ ok: true });
      }
      if (path[2] === 'versions' && method === 'GET')
        return json(
          await all(
            env.DB,
            'SELECT version,created_at FROM content_versions WHERE event_id=? AND tenant_id=? ORDER BY version DESC LIMIT 30',
            e.id,
            e.tenant_id,
          ),
        );
      if (path[2] === 'undo' && method === 'POST') {
        const v = await body(
          request,
          z.object({ version: z.number().int(), currentVersion: z.number().int() }),
        );
        const row = await one<{ content: string }>(
          env.DB,
          'SELECT content FROM content_versions WHERE tenant_id=? AND event_id=? AND version=?',
          e.tenant_id,
          e.id,
          v.version,
        );
        if (!row) fail(404, 'Versi tidak ditemukan.');
        return json(
          await saveEvent(env, a, e, { ...JSON.parse(row.content), version: v.currentVersion }),
        );
      }
      if (path[2] === 'guests') {
        if (!path[3] && method === 'GET')
          return json(
            await listGuests(env, e, pageOf(url), (url.searchParams.get('q') || '').slice(0, 80)),
          );
        if (!path[3] && method === 'POST')
          return json(
            await addGuests(
              env,
              a,
              e,
              (await body(request, z.object({ guests: z.array(guestInput).min(1).max(100) })))
                .guests,
            ),
          );
        if (path[3] === 'export' && method === 'GET')
          return new Response('\ufeff' + (await exportGuests(env, e)), {
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': 'attachment; filename="tamu.csv"',
              'Cache-Control': 'no-store',
            },
          });
        if (path[3] && !path[4] && method === 'PUT')
          return json(await updateGuest(env, a, e, path[3], await body(request, guestInput)));
        if (path[4] === 'link' && method === 'GET') return json(await guestLink(env, e, path[3]));
        if (['rotate', 'revoke'].includes(path[4]) && method === 'POST')
          return json(await rotateGuest(env, a, e, path[3], path[4] === 'revoke'));
        if (path[4] === 'activity' && method === 'POST') {
          const input = await body(request, z.object({ type: z.enum(['clicked', 'sent']) }));
          await stmt(
            env.DB,
            `UPDATE guests SET ${input.type === 'sent' ? 'sent_at' : 'clicked_at'}=? WHERE id=? AND tenant_id=? AND event_id=?`,
            now(),
            path[3],
            e.tenant_id,
            e.id,
          ).run();
          return json({ ok: true });
        }
        if (path[4] === 'moderate' && method === 'POST') {
          const input = await body(request, z.object({ hidden: z.boolean() }));
          await env.DB.batch([
            stmt(
              env.DB,
              'UPDATE responses SET hidden=? WHERE guest_id=? AND tenant_id=? AND event_id=?',
              input.hidden ? 1 : 0,
              path[3],
              e.tenant_id,
              e.id,
            ),
            audit(env, a.id, 'wish.moderate', e.tenant_id, e.id),
          ]);
          return json({ ok: true });
        }
      }
      if (path[2] === 'responses' && method === 'PUT') {
        const input = await body(request, z.object({ open: z.boolean() }));
        await stmt(
          env.DB,
          'UPDATE events SET responses_open=? WHERE id=? AND tenant_id=?',
          input.open ? 1 : 0,
          e.id,
          e.tenant_id,
        ).run();
        return json({ ok: true });
      }
      if (path[2] === 'media') {
        if (!path[3] && method === 'GET') return json(await listMedia(env, e));
        if (!path[3] && method === 'POST') return json(await uploadMedia(env, a, e, request), 201);
        if (path[3] && method === 'DELETE') return json(await deleteMedia(env, a, e, path[3]));
        if (path[3] && method === 'PUT') {
          const m = await body(
            request,
            z.object({
              alt: z.string().max(200),
              focalX: z.number().int().min(0).max(100),
              focalY: z.number().int().min(0).max(100),
            }),
          );
          await stmt(
            env.DB,
            'UPDATE media_assets SET alt=?,focal_x=?,focal_y=? WHERE id=? AND tenant_id=? AND event_id=?',
            m.alt,
            m.focalX,
            m.focalY,
            path[3],
            e.tenant_id,
            e.id,
          ).run();
          return json({ ok: true });
        }
      }
      if (path[2] === 'invoices') {
        if (!path[3] && method === 'GET') return json(await listInvoices(env, e));
        if (!path[3] && method === 'POST')
          return json(await createInvoice(env, a, e, await body(request, invoiceInput)), 201);
        if (path[4] === 'claim' && method === 'POST') {
          const input = await body(
            request,
            z.object({
              name: z.string().min(2).max(100),
              transferredAt: z.number().int(),
              confirmedWhatsApp: z.literal(true),
            }),
          );
          return json(await claimInvoice(env, a, e, path[3], input.name, input.transferredAt));
        }
      }
      if (path[2] === 'compose') {
        if (!path[3] && method === 'GET')
          return json(
            await all(
              env.DB,
              'SELECT id,status,prompt,reply,proposal,draft_version,created_at FROM ai_runs WHERE tenant_id=? AND event_id=? ORDER BY created_at DESC LIMIT 20',
              e.tenant_id,
              e.id,
            ),
          );
        if (!path[3] && method === 'POST')
          return json(await compose(env, a, e, await body(request, composeInput)));
        if (path[3] && method === 'POST') return json(await applyProposal(env, a, e, path[3]));
      }
      if (path[2] === 'editors') {
        if (method === 'GET')
          return json(
            await all(
              env.DB,
              'SELECT u.id,u.name,u.email FROM event_members m JOIN user u ON u.id=m.user_id WHERE m.event_id=? AND m.tenant_id=?',
              e.id,
              e.tenant_id,
            ),
          );
        if (method === 'POST')
          return json(
            await addEditor(
              env,
              a,
              e,
              (await body(request, z.object({ email: z.string().email() }))).email,
            ),
          );
        if (method === 'DELETE') {
          await stmt(
            env.DB,
            'DELETE FROM event_members WHERE tenant_id=? AND event_id=? AND user_id=?',
            e.tenant_id,
            e.id,
            path[3],
          ).run();
          return json({ ok: true });
        }
      }
      if (path[2] === 'tickets') {
        if (method === 'GET')
          return json(
            await all(
              env.DB,
              'SELECT * FROM setup_tickets WHERE tenant_id=? AND event_id=?',
              e.tenant_id,
              e.id,
            ),
          );
        if (method === 'PUT') {
          const input = await body(
            request,
            z.object({ brief: z.string().max(5000), allowSupport: z.boolean() }),
          );
          await env.DB.batch([
            stmt(
              env.DB,
              "UPDATE setup_tickets SET brief=?,access_until=? WHERE id=? AND tenant_id=? AND event_id=? AND status!='completed'",
              input.brief,
              input.allowSupport ? now() + 7 * 86400000 : null,
              path[3],
              e.tenant_id,
              e.id,
            ),
            ...(!input.allowSupport
              ? [
                  stmt(
                    env.DB,
                    'DELETE FROM support_access WHERE tenant_id=? AND event_id=?',
                    e.tenant_id,
                    e.id,
                  ),
                ]
              : []),
            audit(env, a.id, 'support.consent', e.tenant_id, e.id),
          ]);
          return json({ ok: true });
        }
      }
      if (path[2] === 'export' && method === 'GET' && e.owner_id === a.id)
        return json({
          event: JSON.parse(e.draft),
          guests: await exportGuests(env, e),
          invoices: await listInvoices(env, e),
          media: await listMedia(env, e),
        });
    }
    fail(404, 'Halaman tidak ditemukan.');
  } catch (error) {
    return errorResponse(error);
  }
};
