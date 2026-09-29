export const templates = [
  {
    id: 'minimal-ivory',
    version: 1,
    name: 'Minimal Ivory',
    label: 'Sederhana, penuh makna.',
    description: 'Ruang yang lapang dan detail hangat untuk hari istimewa.',
    minPlan: 'starter',
    color: '#eadfd0',
  },
  {
    id: 'botanical-bloom',
    version: 1,
    name: 'Botanical Bloom',
    label: 'Biarkan cinta bertumbuh.',
    description: 'Nuansa taman, warna sage, dan sentuhan bunga yang lembut.',
    minPlan: 'premium',
    color: '#a8b29c',
  },
  {
    id: 'editorial-journey',
    version: 1,
    name: 'Editorial Journey',
    label: 'Setiap bab, tentang kita.',
    description: 'Cerita dan foto yang mengalir dalam sebuah perjalanan.',
    minPlan: 'premium',
    color: '#bb8068',
  },
] as const;
export const plans = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 49000,
    months: 3,
    guests: 150,
    photos: 5,
    media: 75_000_000,
    ai: 10,
    editors: 0,
    hideBrand: false,
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 149000,
    months: 6,
    guests: 500,
    photos: 20,
    media: 250_000_000,
    ai: 50,
    editors: 0,
    hideBrand: true,
  },
  signature: {
    id: 'signature',
    name: 'Signature',
    price: 299000,
    months: 12,
    guests: 1500,
    photos: 40,
    media: 500_000_000,
    ai: 150,
    editors: 1,
    hideBrand: true,
  },
} as const;
export type PlanId = keyof typeof plans;
export const addons = {
  ai: { name: '100 bantuan AI', price: 19000 },
  extension: { name: 'Perpanjangan 6 bulan', price: 49000 },
  setup: { name: 'Jasa setup · 2 revisi', price: 199000 },
} as const;
export const rupiah = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
export const dateLabel = (value: number | null) =>
  value
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(
        value,
      )
    : 'Belum aktif';
// Calendar months, preserving the event's local wall time and clamping month-end.
export function addMonths(timestamp: number, months: number, zone = 'Asia/Jakarta'): number {
  const offset = zone === 'Asia/Jayapura' ? 9 : zone === 'Asia/Makassar' ? 8 : 7;
  const d = new Date(timestamp + offset * 3600000);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.getTime() - offset * 3600000;
}
