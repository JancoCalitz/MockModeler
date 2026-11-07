import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { contentPlugin } from './scripts/content-plugin.ts';
import { serviceWorkerPlugin } from './scripts/service-worker-plugin.ts';

export default defineConfig(({ command }) => ({
  // Relative asset paths let the same build run at / locally and /MockModeler/ on GitHub Pages.
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    // CONTENT_PASSWORD locks the built site's questions behind a password. It comes only from the
    // environment, such as the Pages workflow's secret, so local builds stay unlocked.
    contentPlugin({ password: command === 'build' ? process.env.CONTENT_PASSWORD : undefined }),
    serviceWorkerPlugin(),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['{src,scripts}/**/*.test.{ts,tsx}'],
  },
}));
