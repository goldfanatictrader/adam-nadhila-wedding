import { writeFileSync, mkdirSync, cpSync } from 'node:fs';
mkdirSync('dist-pages', { recursive: true });
cpSync('scripts/pages-worker.js', 'dist-pages/_worker.js');
writeFileSync(
  'dist-pages/README.txt',
  'Redirect-only deployment. Use after the pilot on celeyo.com passes production checks.\n',
);
console.log(
  'Generated dist-pages. Deploy explicitly to the existing Pages project after verifying the new pilot.',
);
