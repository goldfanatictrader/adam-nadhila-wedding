const enc = new TextEncoder();
const hex = (bytes: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (s: string) => Uint8Array.from(s.match(/.{2}/g) || [], (x) => parseInt(x, 16));
export function token() {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}
export async function digest(value: string) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(value)));
}
export async function fingerprint(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(value)));
}
async function key(secret: string) {
  if (!/^[a-f0-9]{64}$/i.test(secret)) throw new Error('Guest encryption key must be 32-byte hex');
  return crypto.subtle.importKey('raw', unhex(secret), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function encrypt(value: string, secret: string, aad: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(aad) },
    await key(secret),
    enc.encode(value),
  );
  return `v1.${hex(iv)}.${hex(cipher)}`;
}
export async function decrypt(value: string, secret: string, aad: string) {
  const [version, iv, data] = value.split('.');
  if (version !== 'v1') throw new Error('Unknown key version');
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unhex(iv), additionalData: enc.encode(aad) },
      await key(secret),
      unhex(data),
    ),
  );
}
