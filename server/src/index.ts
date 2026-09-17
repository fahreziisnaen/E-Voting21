import { createApp } from './app.js';
import { env } from './env.js';
import { prisma } from './lib/prisma.js';

const server = createApp().listen(env.PORT, () => {
  console.log(`[server] E-Voting OSIS berjalan di http://localhost:${env.PORT} (${env.NODE_ENV})`);
  if (env.isProduction && !env.cookieSecure) {
    console.warn(
      '[server] PERINGATAN: COOKIE_SECURE=false. Cookie sesi dapat dikirim lewat http tanpa enkripsi. ' +
        'Gunakan HTTPS (reverse proxy) dan set COOKIE_SECURE=true sebelum pemilihan sungguhan.',
    );
  }
});

function shutdown(signal: string) {
  console.log(`[server] ${signal} diterima, menutup server…`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
