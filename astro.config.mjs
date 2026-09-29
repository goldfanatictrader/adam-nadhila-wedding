import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://celeyo.com',
  output: 'server',
  session: false,
  adapter: cloudflare({
    imageService: 'passthrough',
    configPath: process.env.CLOUDFLARE_WRANGLER_CONFIG || 'wrangler.jsonc',
  }),
  integrations: [react()],
  devToolbar: { enabled: false },
  vite: {
    plugins: [
      {
        name: 'celeyo-private-workspace-files',
        configureServer(server) {
          server.middlewares.use((request, response, next) => {
            let pathname;
            try {
              pathname = decodeURIComponent(
                new URL(request.url || '/', 'http://localhost').pathname,
              );
            } catch {
              response.statusCode = 400;
              response.end();
              return;
            }
            const root = new URL('.', import.meta.url).pathname;
            const path = pathname.startsWith('/@fs' + root)
              ? pathname.slice(4 + root.length - 1)
              : pathname;
            // Vite's HTML middleware does not apply fs.deny to a project-root HTML entry.
            if (/^\/(legacy|scripts|assets|backups)(\/|$)/.test(path)) {
              response.statusCode = 404;
              response.end();
              return;
            }
            next();
          });
        },
      },
    ],
    server: {
      fs: {
        deny: [
          '**/.env',
          '**/.env.*',
          '**/*.{crt,pem}',
          '**/.git/**',
          '**/.dev.vars*',
          '**/*.local.*',
          '**/.wrangler/**',
          ...['scripts', 'assets', 'legacy', 'backups'].map(
            (dir) => new URL(`./${dir}/**`, import.meta.url).pathname,
          ),
        ],
      },
    },
  },
  server: {
    port: 4321,
    host: true,
    allowedHosts: process.env.CELEYO_PREVIEW_HOST ? [process.env.CELEYO_PREVIEW_HOST] : [],
  },
});
