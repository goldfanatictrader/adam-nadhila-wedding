import { create } from 'fontkitten';
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

// Hand-drawn reconstruction of the user-approved CELEYO symbol (reference R1).
// Wordmark outlines use Cormorant Garamond under its existing SIL OFL license.
const font = create(readFileSync('public/fonts/bb8f3c3b0ca403.woff2'));
const out = 'public/brand';
mkdirSync(out, { recursive: true });
const colors = {
  forest: '#142C22',
  terra: '#BC5538',
  peach: '#DFA88D',
  sand: '#E7CEB7',
  ivory: '#FAF1E6',
};
const paths = [
  [
    'terra',
    'M60 5C62.8 16.2 67.3 20.7 77 23.5C67.3 26.3 62.8 30.8 60 42C57.2 30.8 52.7 26.3 43 23.5C52.7 20.7 57.2 16.2 60 5Z',
  ],
  ['peach', 'M9 37C33 29 57 39 58 94C51 66 34 47 9 37Z'],
  ['terra', 'M6 40C29 47 45 66 54 95C41 70 24 58 6 56Z'],
  ['terra', 'M6 59C26 60 47 76 56 112C26 112 5 92 6 59Z'],
  ['sand', 'M111 37C87 29 63 39 62 94C69 66 86 47 111 37Z'],
  ['peach', 'M114 40C91 47 75 66 66 95C79 70 96 58 114 56Z'],
  ['forest', 'M114 59C94 60 73 76 64 112C94 112 115 92 114 59Z'],
];
function symbol(variant = 'color', small = false) {
  return paths
    .map(
      ([color, d], i) =>
        `<path fill="${variant === 'mono' ? colors.forest : variant === 'inverse' ? colors.ivory : colors[color]}" d="${small && i === 0 ? 'M60 5L65 18L78 24L65 30L60 43L55 30L42 24L55 18Z' : d}"/>`,
    )
    .join('');
}
function letters(text, size, spacing, fill) {
  let x = 0;
  const scale = size / font.unitsPerEm;
  const elements = font.glyphsForString(text).map((g) => {
    const path = `<path d="${g.path.toSVG()}" transform="translate(${x.toFixed(3)} 0) scale(${scale.toFixed(5)} ${(-scale).toFixed(5)})"/>`;
    x += g.advanceWidth * scale + spacing;
    return path;
  });
  return { width: x - spacing, svg: `<g fill="${fill}">${elements.join('')}</g>` };
}
const svg = (width, height, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${body}</svg>\n`;
const save = (name, width, height, body) =>
  writeFileSync(`${out}/${name}.svg`, svg(width, height, body));
for (const variant of ['color', 'mono', 'inverse']) {
  const suffix = variant === 'color' ? '' : `-${variant}`;
  const ink = variant === 'inverse' ? colors.ivory : colors.forest;
  const word = letters('CELEYO', 96, 13, ink);
  const tagline = letters('Create. Invite. Celebrate.', 25, 1.6, ink);
  const width = Math.ceil(146 + word.width + 12);
  save(`symbol${suffix}`, 120, 120, symbol(variant));
  save(
    `logo-compact${suffix}`,
    width,
    120,
    `<g>${symbol(variant)}</g><g transform="translate(146 90)">${word.svg}</g>`,
  );
  save(
    `logo-horizontal${suffix}`,
    width,
    148,
    `<g transform="translate(0 9)">${symbol(variant)}</g><g transform="translate(146 89)">${word.svg}</g><g transform="translate(${146 + (word.width - tagline.width) / 2} 125)">${tagline.svg}</g>`,
  );
  const wide = word.width + 48;
  save(
    `logo-stacked${suffix}`,
    wide,
    380,
    `<g transform="translate(${(wide - 210) / 2} 0) scale(1.75)">${symbol(variant)}</g><g transform="translate(24 292)">${word.svg}</g><g transform="translate(${(wide - tagline.width) / 2} 340)">${tagline.svg}</g>`,
  );
}
for (const [name, bg, variant] of [
  ['app-icon', colors.ivory, 'color'],
  ['app-icon-terracotta', colors.terra, 'inverse'],
  ['app-icon-forest', colors.forest, 'inverse'],
]) {
  save(
    name,
    192,
    192,
    `<rect width="192" height="192" rx="42" fill="${bg}"/><g transform="translate(31 27) scale(1.08)">${symbol(variant)}</g>`,
  );
}
// Simplified favicon geometry remains crisp at 16 px without the wordmark.
writeFileSync(
  'public/favicon.svg',
  svg(
    64,
    64,
    `<rect width="64" height="64" rx="15" fill="${colors.ivory}"/><g transform="translate(5 4) scale(.45)">${symbol('color', true)}</g>`,
  ),
);
for (const size of [32, 180, 192, 512])
  await sharp(`${out}/app-icon.svg`).resize(size, size).png().toFile(`${out}/icon-${size}.png`);
// ICO container with a 32 px PNG image (supported by modern browsers).
const png = readFileSync(`${out}/icon-32.png`),
  ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2);
ico.writeUInt16LE(1, 4);
ico[6] = 32;
ico[7] = 32;
ico.writeUInt16LE(1, 10);
ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png.length, 14);
ico.writeUInt32LE(22, 18);
writeFileSync('public/favicon.ico', Buffer.concat([ico, png]));
const socialLogo = readFileSync(`${out}/logo-stacked.svg`, 'utf8').replace(
  '<svg ',
  '<svg x="372" y="67" width="456" height="380" ',
);
const social = svg(
  1200,
  630,
  `<rect width="1200" height="630" fill="${colors.ivory}"/><rect x="28" y="28" width="1144" height="574" rx="20" stroke="${colors.sand}" fill="none"/>${socialLogo}<g transform="translate(383 524)">${letters('Untuk momen yang berarti.', 29, 1.2, colors.forest).svg}</g>`,
);
writeFileSync(`${out}/social-card.svg`, social);
await sharp(Buffer.from(social)).png().toFile(`${out}/social-card.png`);
console.log('CELEYO SVG lockups, app icons, favicons and social artwork generated.');

await sharp(`${out}/logo-horizontal.svg`, { density: 144 })
  .resize({ width: 630 })
  .png()
  .toFile(`${out}/logo-email.png`);
