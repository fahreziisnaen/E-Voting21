import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL wajib diisi'),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET minimal 32 karakter'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET minimal 32 karakter'),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
    REFRESH_TOKEN_TTL_HOURS: z.coerce.number().int().positive().default(12),
    COOKIE_SECURE: booleanString.default(true),
    TRUST_PROXY: z.string().default('false'),
    UPLOAD_DIR: z.string().default('uploads'),
    CLIENT_DIST_DIR: z.string().default('../client/dist'),
  })
  .refine((e) => e.JWT_ACCESS_SECRET !== e.JWT_REFRESH_SECRET, {
    message: 'JWT_ACCESS_SECRET dan JWT_REFRESH_SECRET harus berbeda',
    path: ['JWT_REFRESH_SECRET'],
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Konfigurasi environment tidak valid (lihat server/.env.example):\n${problems}`);
}

function parseTrustProxy(value: string): boolean | number | string {
  if (value === 'true') return true;
  if (value === 'false' || value === '') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

/** Folder `server/` — sama untuk `src/` (tsx) maupun `dist/` (build). */
export const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  // Wajib true bila diakses lewat HTTPS. false hanya untuk akses http (uji coba / jaringan lokal):
  // browser tidak menyimpan cookie `Secure` di origin http selain localhost.
  cookieSecure: parsed.data.COOKIE_SECURE,
  trustProxy: parseTrustProxy(parsed.data.TRUST_PROXY),
  uploadRoot: path.resolve(serverRoot, parsed.data.UPLOAD_DIR),
  clientDistDir: path.resolve(serverRoot, parsed.data.CLIENT_DIST_DIR),
};
