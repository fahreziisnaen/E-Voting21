import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../lib/http-error.js';
import { verifyAgainstDummy, verifyPassword } from '../lib/password.js';
import { prisma } from '../lib/prisma.js';
import {
  ACCESS_COOKIE,
  clearAuthCookies,
  REFRESH_COOKIE,
  setAuthCookies,
  verifyAccessToken,
  verifyRefreshToken,
} from '../lib/tokens.js';
import { currentUser, requireAuth, sessionUserSelect, toSessionUser, toUserDto } from '../middleware/auth.js';
import { issueCsrfToken } from '../middleware/csrf.js';
import { loginAttemptLimiter, loginIpLimiter } from '../middleware/rate-limit.js';
import { AUDIT, recordAudit } from '../services/audit.js';

export const authRouter = Router();

const loginSchema = z.object({
  nis: z.string({ error: 'NIS / username wajib diisi.' }).trim().min(1, 'NIS / username wajib diisi.').max(64),
  password: z.string({ error: 'Kode akses wajib diisi.' }).min(1, 'Kode akses wajib diisi.').max(128),
});

authRouter.get('/csrf', (req, res) => {
  res.json({ csrfToken: issueCsrfToken(req, res) });
});

authRouter.post('/login', loginIpLimiter, loginAttemptLimiter, async (req, res) => {
  const { nis, password } = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({
    where: { nis },
    select: { ...sessionUserSelect, passwordHash: true },
  });
  const valid = user ? await verifyPassword(user.passwordHash, password) : await verifyAgainstDummy(password);

  if (!user || !valid) {
    await recordAudit({
      action: AUDIT.LOGIN,
      status: 'failed',
      userId: user?.id,
      actor: nis,
      metadata: { reason: 'invalid_credentials', ip: req.ip },
    });
    throw new HttpError(401, 'NIS/username atau kode akses salah. Periksa kembali lalu coba lagi.', 'INVALID_CREDENTIALS');
  }

  setAuthCookies(res, user);
  await recordAudit({
    action: AUDIT.LOGIN,
    status: 'success',
    userId: user.id,
    actor: user.nis,
    metadata: { role: user.role, ip: req.ip },
  });
  res.json({ user: toUserDto(toSessionUser(user)) });
});

authRouter.post('/refresh', async (req, res) => {
  const token: unknown = req.cookies?.[REFRESH_COOKIE];
  const payload = typeof token === 'string' ? verifyRefreshToken(token) : null;
  const user = payload
    ? await prisma.user.findUnique({ where: { id: payload.userId }, select: sessionUserSelect })
    : null;

  if (!payload || !user || user.tokenVersion !== payload.tokenVersion) {
    clearAuthCookies(res);
    throw new HttpError(401, 'Sesi Anda telah berakhir. Silakan masuk kembali.', 'SESSION_EXPIRED');
  }
  setAuthCookies(res, user);
  res.json({ user: toUserDto(toSessionUser(user)) });
});

authRouter.post('/logout', async (req, res) => {
  const access: unknown = req.cookies?.[ACCESS_COOKIE];
  const refresh: unknown = req.cookies?.[REFRESH_COOKIE];
  const fromAccess = typeof access === 'string' ? verifyAccessToken(access, { ignoreExpiration: true }) : 'invalid';
  const session =
    typeof fromAccess === 'object' ? fromAccess : typeof refresh === 'string' ? verifyRefreshToken(refresh) : null;

  if (session) {
    // Menaikkan tokenVersion mencabut semua sesi akun ini (penting di komputer lab bersama).
    const revoked = await prisma.user.updateMany({
      where: { id: session.userId, tokenVersion: session.tokenVersion },
      data: { tokenVersion: { increment: 1 } },
    });
    if (revoked.count === 1) {
      await recordAudit({ action: AUDIT.LOGOUT, status: 'success', userId: session.userId });
    }
  }
  clearAuthCookies(res);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = currentUser(req);
  const vote =
    user.role === 'student' && user.hasVoted
      ? await prisma.vote.findUnique({ where: { userId: user.id }, select: { receiptCode: true, votedAt: true } })
      : null;
  res.json({ user: toUserDto(user), hasVoted: user.hasVoted, vote });
});
