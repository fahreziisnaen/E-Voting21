import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/http-error.js';
import { CSRF_COOKIE, csrfCookieOptions } from '../lib/tokens.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

/** Mengembalikan token CSRF yang ada, atau membuat yang baru (double-submit cookie). */
export function issueCsrfToken(req: Request, res: Response): string {
  const existing: unknown = req.cookies?.[CSRF_COOKIE];
  if (typeof existing === 'string' && TOKEN_PATTERN.test(existing)) return existing;
  const token = randomBytes(32).toString('base64url');
  res.cookie(CSRF_COOKIE, token, csrfCookieOptions());
  return token;
}

export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();
  const cookie: unknown = req.cookies?.[CSRF_COOKIE];
  const header = req.get('x-csrf-token');
  if (typeof cookie !== 'string' || !header || !safeEqual(cookie, header)) {
    throw new HttpError(403, 'Sesi keamanan tidak valid. Muat ulang halaman lalu coba lagi.', 'CSRF_INVALID');
  }
  next();
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
