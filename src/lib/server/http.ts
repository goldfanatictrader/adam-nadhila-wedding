import { z } from 'zod';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}
export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}
export async function body<T>(request: Request, schema: z.ZodType<T>, limit = 256_000): Promise<T> {
  if (!request.headers.get('content-type')?.includes('application/json')) fail(415, 'Kirim JSON.');
  const buffer = await bounded(request, limit);
  try {
    return schema.parse(JSON.parse(new TextDecoder().decode(buffer)));
  } catch {
    fail(400, 'Data tidak valid. Periksa isian dan coba lagi.');
  }
}
export async function bounded(request: Request, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(request.headers.get('content-length') || 0) > limit)
    fail(413, 'File atau pesan terlalu besar.');
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      fail(413, 'File atau pesan terlalu besar.');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}
export function errorResponse(error: unknown) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  if (
    error instanceof Error &&
    /CHECK constraint|UNIQUE constraint|FOREIGN KEY|constraint failed/i.test(error.message)
  )
    return json(
      { error: 'Data berubah atau batas paket tercapai. Muat ulang lalu coba lagi.' },
      409,
    );
  // Do not log request URLs, bodies, cookies, SQL bindings, or provider responses.
  console.error('CELEYO request failed', error instanceof Error ? error.name : 'UnknownError');
  return json({ error: 'Permintaan belum dapat diproses. Silakan coba lagi.' }, 500);
}
