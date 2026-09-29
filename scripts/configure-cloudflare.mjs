import { writeFileSync } from 'node:fs';
const environment = process.env.CELEYO_ENV || 'production';
if (!['production', 'staging'].includes(environment))
  throw new Error('CELEYO_ENV must be production or staging.');
const required = [
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_D1_DATABASE_ID',
  'CLOUDFLARE_R2_BUCKET',
  'PUBLIC_SITE_URL',
  'PUBLIC_TURNSTILE_SITE_KEY',
  'EMAIL_FROM',
];
for (const key of required)
  if (!process.env[key]) throw new Error(`Configure ${key} before deployment.`);
const origin = new URL(process.env.PUBLIC_SITE_URL);
if (origin.protocol !== 'https:' || origin.origin !== process.env.PUBLIC_SITE_URL)
  throw new Error('PUBLIC_SITE_URL must be an HTTPS origin without a trailing slash.');
if (environment === 'production' && origin.hostname !== 'celeyo.com')
  throw new Error('Production origin must be https://celeyo.com.');
if (environment === 'staging' && origin.hostname === 'celeyo.com')
  throw new Error('Staging must use a separate hostname.');
if (
  !/^[0-9a-f-]{36}$/i.test(process.env.CLOUDFLARE_D1_DATABASE_ID) ||
  process.env.CLOUDFLARE_D1_DATABASE_ID === '00000000-0000-0000-0000-000000000000'
)
  throw new Error('Use the actual D1 database ID.');
const config = {
  $schema: 'node_modules/wrangler/config-schema.json',
  name: `celeyo-${environment}`,
  main: 'src/worker.ts',
  account_id: process.env.CLOUDFLARE_ACCOUNT_ID,
  compatibility_date: '2026-09-29',
  compatibility_flags: ['nodejs_compat'],
  workers_dev: environment === 'staging',
  routes: [{ pattern: origin.hostname, custom_domain: true }],
  assets: { binding: 'ASSETS' },
  d1_databases: [
    {
      binding: 'DB',
      database_name: `celeyo-${environment}`,
      database_id: process.env.CLOUDFLARE_D1_DATABASE_ID,
      migrations_dir: 'migrations',
    },
  ],
  r2_buckets: [{ binding: 'MEDIA', bucket_name: process.env.CLOUDFLARE_R2_BUCKET }],
  ai: { binding: 'AI' },
  send_email: [{ name: 'EMAIL' }],
  vars: {
    APP_ENV: environment,
    PUBLIC_SITE_URL: origin.origin,
    BETTER_AUTH_URL: origin.origin,
    PUBLIC_TURNSTILE_SITE_KEY: process.env.PUBLIC_TURNSTILE_SITE_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    AI_ENABLED: process.env.AI_ENABLED || 'false',
    AI_DAILY_BUDGET_MICRO_USD: process.env.AI_DAILY_BUDGET_MICRO_USD || '100000',
  },
  triggers: { crons: ['*/15 * * * *'] },
  observability: { enabled: false },
  limits: { cpu_ms: 30000 },
};
writeFileSync('wrangler.deploy.json', JSON.stringify(config, null, 2) + '\n');
console.log(`Generated ${environment} bindings. No resources have been created.`);
