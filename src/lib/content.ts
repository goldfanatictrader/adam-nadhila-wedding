import { z } from 'zod';
const text = (max: number) => z.string().trim().max(max);
const media = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{1,100}$/)
  .or(z.literal(''));
const web = z
  .string()
  .url()
  .refine((v) => v.startsWith('https://'), 'Gunakan URL HTTPS')
  .or(z.literal(''));
export const contentSchema = z
  .object({
    groom: text(100),
    bride: text(100),
    groomFull: text(150),
    brideFull: text(150),
    groomParents: text(300),
    brideParents: text(300),
    groomInstagram: text(50),
    brideInstagram: text(50),
    opening: text(1500),
    closing: text(1500),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .or(z.literal('')),
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .or(z.literal('')),
    timezone: z.enum(['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura']),
    eventName: text(100),
    venue: text(200),
    address: text(1000),
    maps: web,
    story: z
      .array(
        z.object({
          title: text(120),
          body: text(1500),
          photo: media,
          kicker: text(100).optional(),
          quote: text(200).optional(),
          photo2: media.optional(),
          moments: z.array(media).max(2).optional(),
        }),
      )
      .max(5),
    storyIntro: text(1500).optional(),
    welcomeLead: text(500).optional(),
    hero: media,
    introPhoto: media,
    eventPhoto: media,
    closingPhoto: media,
    gallery: z.array(z.object({ id: media, alt: text(200) })).max(40),
    gifts: z
      .array(
        z.object({ bank: text(50), number: z.string().regex(/^\d{1,40}$/), holder: text(100) }),
      )
      .max(4),
    music: z.object({
      type: z.enum(['none', 'audio', 'youtube']),
      asset: media,
      youtubeId: z
        .string()
        .regex(/^[\w-]{11}$/)
        .or(z.literal('')),
    }),
    palette: z.enum(['ivory', 'sage', 'terracotta']),
    font: z.enum(['serif', 'modern']),
    hideBrand: z.boolean(),
    sections: z
      .array(z.enum(['story', 'gallery', 'gifts']))
      .max(3)
      .refine((v) => new Set(v).size === v.length),
    whatsappMessage: text(1500),
  })
  .strict();
export type Content = z.infer<typeof contentSchema>;
export const blankContent: Content = {
  groom: '',
  bride: '',
  groomFull: '',
  brideFull: '',
  groomParents: '',
  brideParents: '',
  groomInstagram: '',
  brideInstagram: '',
  opening: 'Dengan penuh kebahagiaan, kami mengundang Anda untuk merayakan hari istimewa kami.',
  closing: 'Terima kasih atas doa dan kehadiran Anda.',
  date: '',
  time: '',
  timezone: 'Asia/Jakarta',
  eventName: 'Akad & Resepsi',
  venue: '',
  address: '',
  maps: '',
  story: [],
  hero: '',
  introPhoto: '',
  eventPhoto: '',
  closingPhoto: '',
  gallery: [],
  gifts: [],
  music: { type: 'none', asset: '', youtubeId: '' },
  palette: 'ivory',
  font: 'serif',
  hideBrand: false,
  sections: ['story', 'gallery', 'gifts'],
  whatsappMessage:
    'Yth. {nama}, dengan bahagia kami mengundang Anda ke pernikahan kami. Detail acara dan konfirmasi kehadiran: {link}',
};
export function assetIds(c: Content): string[] {
  return [
    ...new Set(
      [
        c.hero,
        c.introPhoto,
        c.eventPhoto,
        c.closingPhoto,
        ...c.story.flatMap((x) => [x.photo, x.photo2 || '', ...(x.moments || [])]),
        ...c.gallery.map((x) => x.id),
        ...(c.music.type === 'audio' ? [c.music.asset] : []),
      ].filter(Boolean),
    ),
  ];
}
export function eventTime(c: Content): number {
  const offset =
    c.timezone === 'Asia/Jayapura'
      ? '+09:00'
      : c.timezone === 'Asia/Makassar'
        ? '+08:00'
        : '+07:00';
  return Date.parse(`${c.date}T${c.time || '00:00'}:00${offset}`);
}
export function publishErrors(c: Content): string[] {
  const errors: string[] = [];
  for (const field of ['groom', 'bride', 'date', 'time', 'venue', 'address'] as const)
    if (!c[field]) errors.push(`Lengkapi ${field}.`);
  if (
    !Number.isFinite(eventTime(c)) ||
    new Date(`${c.date}T00:00:00Z`).toISOString().slice(0, 10) !== c.date
  )
    errors.push('Tanggal acara tidak valid.');
  if (c.music.type === 'audio' && !c.music.asset) errors.push('Pilih file audio.');
  if (c.music.type === 'youtube' && !c.music.youtubeId) errors.push('Pilih video YouTube.');
  return errors;
}
export function whatsappUrl(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
export function normalizePhone(value: string): string {
  const p = value.replace(/[\s()+-]/g, '').replace(/^0/, '62');
  if (p && !/^[1-9]\d{7,14}$/.test(p)) throw new Error('Nomor WhatsApp tidak valid.');
  return p;
}
export function csvCell(value: unknown): string {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
