import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import type { Env, Actor, EventRow } from '../src/lib/types';
import { blankContent } from '../src/lib/content';
import { plans, addons } from '../src/lib/catalog';
export class LocalD1 {
  raw = new DatabaseSync(':memory:');
  constructor() {
    for (const file of readdirSync('migrations')
      .filter((f) => f.endsWith('.sql'))
      .sort())
      this.raw.exec(readFileSync('migrations/' + file, 'utf8'));
  }
  prepare(sql: string) {
    return new Prepared(this, sql, []);
  }
  async batch(statements: Prepared[]) {
    this.raw.exec('BEGIN');
    try {
      const results = statements.map((s) => s.execute());
      this.raw.exec('COMMIT');
      return results;
    } catch (e) {
      this.raw.exec('ROLLBACK');
      throw e;
    }
  }
  close() {
    this.raw.close();
  }
}
class Prepared {
  constructor(
    public db: LocalD1,
    public sql: string,
    public values: any[],
  ) {}
  bind(...values: any[]) {
    return new Prepared(this.db, this.sql, values);
  }
  execute() {
    const stmt = this.db.raw.prepare(this.sql);
    if (/^\s*(SELECT|PRAGMA)/i.test(this.sql) || /\bRETURNING\b/i.test(this.sql)) {
      const results = stmt.all(...this.values);
      return { success: true, results, meta: { changes: results.length } };
    }
    const result = stmt.run(...this.values);
    return { success: true, results: [], meta: { changes: Number(result.changes) } };
  }
  async all() {
    return this.execute();
  }
  async first() {
    return this.execute().results[0] ?? null;
  }
  async run() {
    return this.execute();
  }
}
export function fixtures() {
  const local = new LocalD1();
  const media = new Map<string, { data: Uint8Array; type: string }>();
  const env = {
    DB: local as unknown as D1Database,
    MEDIA: {
      async put(key: string, data: Uint8Array, options: any) {
        media.set(key, { data, type: options.httpMetadata.contentType });
      },
      async delete(key: string) {
        media.delete(key);
      },
      async head(key: string) {
        const v = media.get(key);
        return v ? { size: v.data.length, httpEtag: '"test-etag"' } : null;
      },
      async get(key: string, options?: any) {
        const v = media.get(key);
        if (!v) return null;
        const bytes = options?.range
          ? v.data.slice(options.range.offset, options.range.offset + options.range.length)
          : v.data;
        return { body: bytes };
      },
    } as unknown as R2Bucket,
    APP_ENV: 'local',
    PUBLIC_SITE_URL: 'http://localhost:4321',
    BETTER_AUTH_URL: 'http://localhost:4321',
    BETTER_AUTH_SECRET: 'a'.repeat(64),
    GUEST_ENCRYPTION_KEY: 'b'.repeat(64),
    RATE_LIMIT_SECRET: 'c'.repeat(64),
    EMAIL_FROM: 'test@celeyo.test',
    AI_ENABLED: 'false',
    AI_DAILY_BUDGET_MICRO_USD: '100000',
  } satisfies Env;
  const stamp = Date.now();
  function user(n: string, admin = false): Actor {
    local.raw
      .prepare(
        'INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,1,?,?)',
      )
      .run(n, n, n + '@celeyo.test', stamp, stamp);
    if (admin) local.raw.prepare('INSERT INTO operators VALUES(?)').run(n);
    return {
      id: n,
      name: n,
      email: n + '@celeyo.test',
      verified: true,
      admin,
      mfa: admin,
      sessionId: 'session-' + n,
    };
  }
  const owner = user('owner'),
    other = user('other'),
    operator = user('operator', true),
    editor = user('editor');
  function event(n: string, a: Actor, plan: string | null = 'signature'): EventRow {
    const tenant = 'tenant-' + a.id;
    local.raw
      .prepare('INSERT OR IGNORE INTO tenants(id,owner_id,created_at) VALUES(?,?,?)')
      .run(tenant, a.id, stamp);
    const content = {
      ...blankContent,
      groom: 'Aruna',
      bride: 'Bima',
      date: new Date(stamp + 86400000 * 10).toISOString().slice(0, 10),
      time: '09:00',
      venue: 'Taman',
      address: 'Alamat contoh',
    };
    const p = plans[(plan || 'starter') as keyof typeof plans];
    local.raw
      .prepare(
        'INSERT INTO events(id,tenant_id,owner_id,slug,title,template_id,draft,trial_expires_at,created_at,plan,plan_snapshot,paid_at,activated_at,expires_at,duration_months,ai_credits,guest_limit,media_limit,photo_limit) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      )
      .run(
        n,
        tenant,
        a.id,
        n,
        n,
        'minimal-ivory',
        JSON.stringify(content),
        stamp + 7 * 86400000,
        stamp,
        plan,
        plan ? JSON.stringify({ book: { id: 'launch-v1', plans, addons } }) : null,
        plan ? stamp : null,
        plan ? stamp : null,
        plan ? stamp + 365 * 86400000 : null,
        plan ? p.months : 0,
        plan ? p.ai : 3,
        plan ? p.guests : 0,
        plan ? p.media : 25000000,
        plan ? p.photos : 3,
      );
    return local.raw.prepare('SELECT * FROM events WHERE id=?').get(n) as EventRow;
  }
  local.raw.prepare('INSERT INTO settings VALUES(?,?,?)').run(
    'billing',
    JSON.stringify({
      bank: 'BANK UJI',
      number: '1234567890',
      holder: 'DATA FIKTIF',
      whatsapp: '628111111111',
      refundPolicy: 'Kebijakan fiktif khusus pengujian lokal, bukan pembayaran nyata.',
      version: 'test-v1',
    }),
    stamp,
  );
  return { env, local, media, owner, other, operator, editor, event };
}
