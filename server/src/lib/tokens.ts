import jwt from 'jsonwebtoken';
import type { CookieOptions, Response } from 'express';
import { env } from '../env.js';

export const ACCESS_COOKIE = 'ev_access';
export const REFRESH_COOKIE = 'ev_refresh';
export const CSRF_COOKIE = 'ev_csrf';

const ISSUER = 'evoting-osis-sman21';

interface TokenSubject {
  id: number;
  tokenVersion: number;
}

export interface VerifiedToken {
  userId: number;
  tokenVersion: number;
}

export type AccessTokenResult = VerifiedToken | 'expired' | 'invalid';

function baseCookie(): CookieOptions {
  return { httpOnly: true, secure: env.cookieSecure, sameSite: 'strict' };
}

function sign(user: TokenSubject, secret: string, audience: string, expiresInSeconds: number): string {
  return jwt.sign({ tv: user.tokenVersion }, secret, {
    algorithm: 'HS256',
    subject: String(user.id),
    issuer: ISSUER,
    audience,
    expiresIn: expiresInSeconds,
  });
}

function verify(token: string, secret: string, audience: string, ignoreExpiration = false): AccessTokenResult {
  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience,
      ignoreExpiration,
    });
    if (typeof payload === 'string' || typeof payload.tv !== 'number') return 'invalid';
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) return 'invalid';
    return { userId, tokenVersion: payload.tv };
  } catch (err) {
    return err instanceof jwt.TokenExpiredError ? 'expired' : 'invalid';
  }
}

export function verifyAccessToken(token: string, { ignoreExpiration = false } = {}): AccessTokenResult {
  return verify(token, env.JWT_ACCESS_SECRET, 'access', ignoreExpiration);
}

export function verifyRefreshToken(token: string): VerifiedToken | null {
  const result = verify(token, env.JWT_REFRESH_SECRET, 'refresh');
  return typeof result === 'object' ? result : null;
}

export function setAuthCookies(res: Response, user: TokenSubject): void {
  const accessTtl = env.ACCESS_TOKEN_TTL_MINUTES * 60;
  const refreshTtl = env.REFRESH_TOKEN_TTL_HOURS * 60 * 60;
  res.cookie(ACCESS_COOKIE, sign(user, env.JWT_ACCESS_SECRET, 'access', accessTtl), {
    ...baseCookie(),
    path: '/',
  });
  res.cookie(REFRESH_COOKIE, sign(user, env.JWT_REFRESH_SECRET, 'refresh', refreshTtl), {
    ...baseCookie(),
    path: '/api/auth',
    maxAge: refreshTtl * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookie(), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...baseCookie(), path: '/api/auth' });
}

export function csrfCookieOptions(): CookieOptions {
  // Sengaja tidak httpOnly: client membaca nilainya lalu mengirim ulang di header (double-submit).
  return { httpOnly: false, secure: env.cookieSecure, sameSite: 'strict', path: '/' };
}
