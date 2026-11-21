import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite';

// PWA instalable y offline-first (app shell). Sin APIs de pago ni keys.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Ruta Urbana',
        short_name: 'RutaUrbana',
        description: 'RPG de exploración urbana IRL: misiones, niebla y NPCs.',
        lang: 'es',
        start_url: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0D0D14',
        theme_color: '#0D0D14',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // App shell offline. Los tiles del mapa requieren red (se cachean en runtime).
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
});
