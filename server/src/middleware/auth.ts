import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../generated/prisma/client.js';
import { HttpError } from '../lib/http-error.js';
import { prisma } from '../lib/prisma.js';
import { ACCESS_COOKIE, verifyAccessToken } from '../lib/tokens.js';

export const sessionUserSelect = {
  id: true,
  nis: true,
  name: true,
  role: true,
  hasVoted: true,
  tokenVersion: true,
  schoolClass: { select: { name: true } },
} as const;

export interface SessionUser {
  id: number;
  nis: string;
  name: string;
  /** null untuk akun panitia. */
  className: string | null;
  role: Role;
  hasVoted: boolean;
  tokenVersion: number;
}

type SessionUserRow = Omit<SessionUser, 'className'> & { schoolClass: { name: string } | null };

export function toSessionUser({ schoolClass, ...user }: SessionUserRow): SessionUser {
  return { ...user, className: schoolClass?.name ?? null };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

const SESSION_ENDED = 'Sesi Anda telah berakhir. Silakan masuk kembali.';

/**
 * Memvalidasi JWT dari cookie, lalu memuat ulang user dari database — sehingga
 * `hasVoted` dan `role` selalu berasal dari server, bukan dari token/klien.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token: unknown = req.cookies?.[ACCESS_COOKIE];
  if (typeof token !== 'string' || !token) {
    throw new HttpError(401, SESSION_ENDED, 'UNAUTHENTICATED');
  }
  const result = verifyAccessToken(token);
  if (result === 'expired') throw new HttpError(401, SESSION_ENDED, 'TOKEN_EXPIRED');
  if (result === 'invalid') throw new HttpError(401, SESSION_ENDED, 'UNAUTHENTICATED');

  const user = await prisma.user.findUnique({ where: { id: result.userId }, select: sessionUserSelect });
  if (!user || user.tokenVersion !== result.tokenVersion) {
    throw new HttpError(401, SESSION_ENDED, 'SESSION_REVOKED');
  }
  req.user = toSessionUser(user);
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new HttpError(401, SESSION_ENDED, 'UNAUTHENTICATED');
    if (!roles.includes(req.user.role)) {
      throw new HttpError(403, 'Anda tidak memiliki akses untuk tindakan ini.', 'FORBIDDEN');
    }
    next();
  };
}

/** Dipakai setelah `requireAuth`. */
export function currentUser(req: Request): SessionUser {
  if (!req.user) throw new HttpError(401, SESSION_ENDED, 'UNAUTHENTICATED');
  return req.user;
}

export function toUserDto(user: Pick<SessionUser, 'id' | 'nis' | 'name' | 'className' | 'role'>) {
  return { id: user.id, nis: user.nis, name: user.name, className: user.className, role: user.role };
}
