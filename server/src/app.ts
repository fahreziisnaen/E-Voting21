import { existsSync } from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { z } from 'zod';
import { env } from './env.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler, notFoundApi } from './middleware/error.js';
import { apiLimiter } from './middleware/rate-limit.js';
import { adminRouter } from './routes/admin/index.js';
import { authRouter } from './routes/auth.js';
import { candidatesRouter, categoriesRouter, electionRouter, resultsRouter, votesRouter } from './routes/public.js';

z.config(z.locales.id());

// Endpoint dengan muatan besar memasang parser JSON sendiri (impor pemilih & pemulihan cadangan).
const BIG_BODY_PATHS = new Set([
  '/api/admin/students/import',
  '/api/admin/teachers/import',
  '/api/admin/restore',
  '/api/admin/restore/preview',
]);

export function createApp() {
  const app = express();
  app.set('trust proxy', env.trustProxy);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'img-src': ["'self'", 'data:', 'blob:'],
          'style-src': ["'self'", "'unsafe-inline'"],
          // Saat diakses via http (COOKIE_SECURE=false), directive ini membuat browser meminta
          // aset lewat https sehingga halaman gagal dimuat.
          'upgrade-insecure-requests': env.cookieSecure ? [] : null,
        },
      },
      strictTransportSecurity: env.cookieSecure ? undefined : false,
      crossOriginOpenerPolicy: env.cookieSecure ? undefined : false,
    }),
  );
  // Batas kecil untuk semua endpoint; lihat BIG_BODY_PATHS (parser dipasang setelah cek admin).
  const jsonBody = express.json({ limit: '100kb' });
  app.use((req, res, next) => (BIG_BODY_PATHS.has(req.path) ? next() : jsonBody(req, res, next)));
  app.use(cookieParser());

  app.use(
    '/uploads',
    express.static(env.uploadRoot, { index: false, dotfiles: 'deny', maxAge: '7d', immutable: true, fallthrough: false }),
  );

  const api = express.Router();
  api.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  api.use(apiLimiter, csrfProtection);
  api.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  api.use('/auth', authRouter);
  api.use('/election', electionRouter);
  api.use('/categories', categoriesRouter);
  api.use('/candidates', candidatesRouter);
  api.use('/results', resultsRouter);
  api.use('/votes', votesRouter);
  api.use('/admin', adminRouter);
  api.use(notFoundApi);
  app.use('/api', api);

  // Production: server juga menyajikan hasil build React (satu origin, cookie sameSite=strict aman).
  const indexHtml = path.join(env.clientDistDir, 'index.html');
  if (env.isProduction && existsSync(indexHtml)) {
    app.use(express.static(env.clientDistDir, { index: false, maxAge: '1h' }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
      res.sendFile(indexHtml);
    });
  }

  app.use(errorHandler);
  return app;
}
