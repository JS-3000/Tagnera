import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH is set by the GitHub Actions workflow (e.g. "/Tagnera/").
// Locally the app is served from "/".
const base = process.env.BASE_PATH ?? '/';

export default defineConfig(({ mode }) => ({
  base,
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.1.0') },
  plugins: [
    react(),
    // `npm run dev:https` -> self-signed HTTPS so the phone camera works in the local network
    ...(mode === 'https' ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon-48.png', 'apple-touch-icon.png', 'logo.svg'],
      manifest: {
        name: 'ConnecTag',
        short_name: 'ConnecTag',
        description: 'ConnecTag – brings your tag a level up',
        lang: 'de',
        theme_color: '#1F2A36',
        background_color: '#F4F5F7',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // PDFs are not pre-cached (27 MB) – every document that was opened once is kept
        // in the cache, so it opens again at the plant with poor or no network.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/docs/') && url.pathname.endsWith('.pdf'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'tagnera-docs',
              expiration: { maxEntries: 80 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.endsWith('/docs/manifest.json'),
            handler: 'NetworkFirst',
            options: { cacheName: 'tagnera-docs-manifest', networkTimeoutSeconds: 4 },
          },
        ],
      },
    }),
  ],
}));
