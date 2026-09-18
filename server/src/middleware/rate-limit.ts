import type { Request, Response } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

function limited(message: string) {
  return (_req: Request, res: Response) => {
    res.status(429).json({ message, code: 'RATE_LIMITED' });
  };
}

const common = { standardHeaders: 'draft-8', legacyHeaders: false } as const;
const clientIp = (req: Request) => ipKeyGenerator(req.ip ?? '0.0.0.0');

/**
 * Percobaan gagal per (IP + NIS). Sengaja tidak per-IP saja: seluruh siswa di
 * lab sekolah biasanya keluar lewat satu IP publik yang sama.
 */
export const loginAttemptLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 8,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const nis = typeof req.body?.nis === 'string' ? req.body.nis.trim().toLowerCase().slice(0, 64) : '';
    return `${clientIp(req)}|${nis}`;
  },
  handler: limited('Terlalu banyak percobaan masuk yang gagal. Coba lagi dalam 15 menit atau hubungi panitia.'),
});

/** Batas longgar per IP untuk menahan brute force massal. */
export const loginIpLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 400,
  keyGenerator: clientIp,
  handler: limited('Terlalu banyak permintaan masuk dari jaringan ini. Coba lagi beberapa menit lagi.'),
});

/** Dipasang setelah requireAuth, dihitung per akun. Cukup longgar untuk memilih beberapa kategori berturut-turut. */
export const voteLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: (req) => `user:${req.user?.id ?? clientIp(req)}`,
  handler: limited('Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.'),
});

export const apiLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: 3000,
  keyGenerator: clientIp,
  handler: limited('Server sedang sibuk. Coba lagi sebentar lagi.'),
});
