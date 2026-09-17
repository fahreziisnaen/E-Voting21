import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// API Express berjalan terpisah saat development; Vite meneruskan /api dan /uploads
// sehingga browser tetap satu origin (cookie SameSite=Strict berfungsi).
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:4000';
const proxy = {
  '/api': { target: apiTarget },
  '/uploads': { target: apiTarget },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    css: false,
  },
});
