import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { hashPassword } from 'better-auth/crypto';
const args = new Set(process.argv.slice(2));
if (args.has('--remote'))
  throw new Error(
    'Pilot provisioning uses scripts/provision-pilot.mjs after account verification. This seed is local only.',
  );
const file = 'seed.local.json';
let credentials = existsSync(file)
  ? JSON.parse(readFileSync(file, 'utf8'))
  : { email: 'client@celeyo.test', password: randomBytes(18).toString('base64url') };
if (!existsSync(file)) writeFileSync(file, JSON.stringify(credentials, null, 2), { mode: 0o600 });
const stamp = Date.now(),
  owner = 'local-pilot-owner',
  tenant = 'pilot-tenant',
  event = 'pilot-event';
const mediaId = (name) => 'pilot-' + name.replaceAll('.', '-');
const sqlLiteral = (v) =>
  v === null
    ? 'NULL'
    : typeof v === 'number'
      ? String(v)
      : "'" + String(v).replaceAll("'", "''") + "'";
const q = (sql, ...values) => {
  let i = 0;
  return sql.replace(/\?/g, () => sqlLiteral(values[i++]));
};
const book = {
  id: 'launch-v1',
  plans: {
    starter: {
      id: 'starter',
      name: 'Starter',
      price: 49000,
      months: 3,
      guests: 150,
      photos: 5,
      media: 75000000,
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
      media: 250000000,
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
      media: 500000000,
      ai: 150,
      editors: 1,
      hideBrand: true,
    },
  },
  addons: {
    ai: { name: '100 bantuan AI', price: 19000 },
    extension: { name: 'Perpanjangan 6 bulan', price: 49000 },
    setup: { name: 'Jasa setup · 2 revisi', price: 199000 },
  },
};
const content = {
  groom: 'Adam',
  bride: 'Nadhila',
  groomFull: 'Adam Alfiansyah S.H',
  brideFull: 'Nadhila Rachmawati, S.Psi.',
  groomParents: 'Alm. Bapak Dariansyah\ndan Almh. Ibu Ani Arumiati',
  brideParents: 'Bapak Sugiyanto\ndan Ibu Haniyah Ichlasiyahati',
  groomInstagram: 'adam.alfiansyah',
  brideInstagram: 'nadhilarchmwt',
  opening:
    'Dengan memohon rahmat dan ridho Allah SWT, kami mengundang Bapak/Ibu/Saudara/i untuk merayakan hari bahagia kami.',
  welcomeLead: 'Dari banyak hari sederhana, menuju satu janji untuk berjalan bersama selamanya.',
  closing:
    'Merupakan sebuah kehormatan dan kebahagiaan bagi kami apabila Anda berkenan hadir dan memberikan doa restu.',
  date: '2026-12-26',
  time: '09:00',
  timezone: 'Asia/Jakarta',
  eventName: 'Akad & Syukuran',
  venue: 'Kediaman Mempelai Wanita',
  address: 'Jl. Nilam II, No. 5, RT/RW 04/010\nJatiraden, Jatisampurna\nBekasi 17433',
  maps: 'https://maps.app.goo.gl/tYcqEJPrFE5dXKF79',
  storyIntro:
    'Bukan tentang satu momen besar. Kisah kami tumbuh dari perjalanan kecil, percakapan panjang, dan keyakinan untuk terus memilih satu sama lain.',
  story: [
    {
      title: 'Menemukan rumah\ndalam keseharian.',
      kicker: 'Awal yang sederhana',
      body: 'Di tengah dunia yang terus bergerak, kami menemukan seseorang untuk berjalan bersama—pergi tanpa tergesa, berhenti sejenak, lalu berbicara lebih lama.',
      quote: '“Ada rumah yang bukan sebuah tempat.”',
      photo: mediaId('everyday-2.webp'),
      photo2: mediaId('everyday-4.webp'),
    },
    {
      title: 'Memilih arah\nyang sama.',
      kicker: 'Janji yang tenang',
      body: 'Yang sederhana tumbuh menjadi keyakinan: tentang tetap memilih satu sama lain, menyambut hari ini, esok, dan hari-hari setelahnya.',
      photo: mediaId('horizon-1.webp'),
      moments: [mediaId('horizon-2.webp'), mediaId('horizon-3.webp')],
    },
  ],
  hero: mediaId('hero.webp'),
  introPhoto: mediaId('intro.webp'),
  eventPhoto: mediaId('gallery-6.webp'),
  closingPhoto: mediaId('closing.webp'),
  gallery: Array.from({ length: 6 }, (_, i) => ({
    id: mediaId(`gallery-${i + 1}.webp`),
    alt: [
      'Adam dan Nadhila menikmati waktu bersama di kota',
      'Potret hangat Adam dan Nadhila',
      'Adam dan Nadhila tersenyum bersama',
      'Adam dan Nadhila dalam perjalanan mereka',
      'Kebersamaan Adam dan Nadhila',
      'Adam dan Nadhila memandang cakrawala',
    ][i],
  })),
  gifts: [
    { bank: 'BCA', number: '7401662727', holder: 'Nadhila Rachmawati' },
    { bank: 'BNI', number: '1229896497', holder: 'Nadhila Rachmawati' },
  ],
  music: { type: 'audio', asset: mediaId('paul-partohap-i-got-mine.mp3'), youtubeId: '' },
  palette: 'ivory',
  font: 'serif',
  hideBrand: false,
  sections: ['story', 'gallery', 'gifts'],
  whatsappMessage:
    'Yth. {nama}, dengan bahagia kami mengundang Anda ke pernikahan Adam & Nadhila. Detail acara dan konfirmasi kehadiran: {link}',
};
// Data mapping is an explicit pilot import; no default event or template imports it.
writeFileSync('scripts/pilot-data.json', JSON.stringify(content, null, 2) + '\n');
const commands = [
  q(
    'INSERT OR IGNORE INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,?,?,?);',
    owner,
    'Adam & Nadhila',
    credentials.email,
    1,
    stamp,
    stamp,
  ),
  q(
    'INSERT OR IGNORE INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?);',
    'local-pilot-account',
    owner,
    'credential',
    owner,
    await hashPassword(credentials.password),
    stamp,
    stamp,
  ),
  q(
    'INSERT OR IGNORE INTO tenants(id,owner_id,trial_used,created_at) VALUES(?,?,1,?);',
    tenant,
    owner,
    stamp,
  ),
  q(
    "INSERT OR IGNORE INTO events(id,tenant_id,owner_id,slug,title,template_id,draft,published,version,published_version,published_template_id,status,plan,plan_snapshot,paid_at,activated_at,expires_at,duration_months,ai_credits,media_limit,photo_limit,guest_limit,trial_expires_at,created_at) VALUES(?,?,?,?,?,'editorial-journey',?,?,1,1,'editorial-journey','published','signature',?,?,?,?,12,150,500000000,40,1500,?,?);",
    event,
    tenant,
    owner,
    'adam-nadhila',
    'Pernikahan Adam & Nadhila',
    JSON.stringify(content),
    JSON.stringify(content),
    JSON.stringify({ book, grant: 'pilot' }),
    stamp,
    stamp,
    stamp + 365 * 86400000,
    stamp + 7 * 86400000,
    stamp,
  ),
  q(
    'INSERT OR IGNORE INTO content_versions VALUES(?,?,1,?,?,?);',
    tenant,
    event,
    JSON.stringify({ content, templateId: 'editorial-journey' }),
    owner,
    stamp,
  ),
  q(
    'INSERT OR IGNORE INTO audit_events VALUES(?,?,?,?,?,?,?);',
    'pilot-grant-local',
    owner,
    tenant,
    event,
    'pilot.grant',
    'Signature pilot entitlement; no revenue',
    stamp,
  ),
  q(
    'INSERT OR IGNORE INTO price_versions VALUES(?,?,1,?);',
    'launch-v1',
    JSON.stringify({ plans: book.plans, addons: book.addons }),
    stamp,
  ),
];
const used = new Set([
  content.hero,
  content.introPhoto,
  content.eventPhoto,
  content.closingPhoto,
  content.music.asset,
  ...content.gallery.map((x) => x.id),
  ...content.story.flatMap((x) => [x.photo, x.photo2, ...(x.moments || [])].filter(Boolean)),
]);
const mediaFiles = readdirSync('assets').filter((name) => used.has(mediaId(name)));
for (const filename of mediaFiles) {
  const bytes = readFileSync(join('assets', filename));
  const mid = mediaId(filename),
    kind = filename.endsWith('.mp3') ? 'audio' : 'image',
    mime = kind === 'audio' ? 'audio/mpeg' : 'image/webp';
  commands.push(
    q(
      "INSERT OR IGNORE INTO media_assets(id,tenant_id,event_id,object_key,filename,mime,size,kind,status,created_at,checksum) VALUES(?,?,?,?,?,?,?,?,'ready',?,?);",
      mid,
      tenant,
      event,
      `${tenant}/${event}/${mid}`,
      filename,
      mime,
      bytes.length,
      kind,
      stamp,
      createHash('sha256').update(bytes).digest('hex'),
    ),
  );
  for (const state of ['draft', 'published'])
    commands.push(
      q('INSERT OR IGNORE INTO media_refs VALUES(?,?,?,?);', tenant, event, mid, state),
    );
}
const temp = mkdtempSync(join(tmpdir(), 'celeyo-seed-'));
try {
  const path = join(temp, 'seed.sql');
  writeFileSync(path, commands.join('\n'), { mode: 0o600 });
  const db = spawnSync('npx', ['wrangler', 'd1', 'execute', 'DB', '--local', '--file', path], {
    encoding: 'utf8',
  });
  if (db.status) throw new Error('Local seed failed. Check migrations and schema.');
  for (const name of mediaFiles) {
    const object = spawnSync(
      'npx',
      [
        'wrangler',
        'r2',
        'object',
        'put',
        `celeyo-local/${tenant}/${event}/${mediaId(name)}`,
        '--local',
        '--file',
        join('assets', name),
        '--content-type',
        name.endsWith('.mp3') ? 'audio/mpeg' : 'image/webp',
      ],
      { encoding: 'utf8' },
    );
    if (object.status) throw new Error(`Local R2 import failed for ${name}`);
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}
console.log(
  'Local pilot seeded. Test credentials are in ignored seed.local.json. No remote resources, emails, or payments were used.',
);
