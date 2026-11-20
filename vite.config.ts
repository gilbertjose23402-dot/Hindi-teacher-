import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// On GitHub Pages the app lives under /<repo-name>/ — the deploy workflow sets BASE_PATH.
const base = process.env.BASE_PATH || '/'

export default defineConfig({
  base,
  worker: { format: 'es' },
  build: { chunkSizeWarningLimit: 7000 },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      // 'prompt': a new version waits instead of reloading the page mid-conversation.
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Rani — Hindi & Marathi Tutor',
        short_name: 'Rani',
        description: 'Talk with Rani every day to learn Hindi grammar and Marathi.',
        lang: 'en-IN',
        theme_color: '#2f2a7a',
        background_color: '#f7f5f0',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // The on-phone AI runtime (~6 MB) is cached the first time it is used, not at install.
        globIgnores: ['**/lib-*.js', '**/brain.worker-*.js'],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/(lib|brain\.worker)-[\w-]+\.js$/,
            handler: 'CacheFirst',
            options: { cacheName: 'rani-ai-runtime', expiration: { maxEntries: 6 } },
          },
        ],
      },
    }),
  ],
})
