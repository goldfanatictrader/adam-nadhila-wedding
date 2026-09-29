import type { Env } from '../types';
export const id = () => crypto.randomUUID();
export const now = () => Date.now();
export function stmt(db: D1Database, sql: string, ...values: unknown[]) {
  return db.prepare(sql).bind(...values);
}
export async function one<T>(db: D1Database, sql: string, ...values: unknown[]) {
  return stmt(db, sql, ...values).first<T>();
}
export async function all<T>(db: D1Database, sql: string, ...values: unknown[]) {
  return (await stmt(db, sql, ...values).all<T>()).results;
}
// D1 batch is transactional. A failed CHECK rolls back every statement, including writes
// after the guard. This closes read/check/write races without BEGIN on the D1 API.
export async function atomic(
  db: D1Database,
  condition: string,
  values: unknown[],
  writes: D1PreparedStatement[],
) {
  const key = id();
  return db.batch([
    stmt(
      db,
      `INSERT INTO transaction_guards(id,ok) VALUES(?,COALESCE((${condition}),0))`,
      key,
      ...values,
    ),
    ...writes,
    stmt(db, 'DELETE FROM transaction_guards WHERE id=?', key),
  ]);
}
export function audit(
  env: Env,
  actor: string,
  action: string,
  tenant: string | null = null,
  event: string | null = null,
  detail = '',
) {
  return stmt(
    env.DB,
    'INSERT INTO audit_events VALUES(?,?,?,?,?,?,?)',
    id(),
    actor,
    tenant,
    event,
    action,
    detail,
    now(),
  );
}
