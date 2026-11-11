import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    // Workbox (generateSW) precaches the app shell so the POS boots with no network.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'MultiLingual POS',
        short_name: 'POS',
        description: 'Il gestionale che parla la tua lingua',
        theme_color: '#059669',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        // Precached at install: the app, plus the three small fonts the UI always needs (~320 KB):
        // Latin, Arabic, Bengali. Every other font file (other scripts of Inter, and the 100 Chinese
        // slices, 4.6 MB) is cached the first time it is used instead of at install.
        globPatterns: [
          '**/*.{js,css,html,svg,png}',
          'assets/inter-latin-wght-normal-*.woff2',
          'assets/noto-sans-arabic-arabic-wght-normal-*.woff2',
          'assets/noto-sans-bengali-bengali-wght-normal-*.woff2',
        ],
        runtimeCaching: [
          {
            urlPattern: ({ url }: { url: URL }) => /\/assets\/.*\.woff2$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 150, maxAgeSeconds: 365 * 24 * 60 * 60 } },
          },
        ],
        navigateFallback: '/index.html',
      },
    }),
  ],
});
