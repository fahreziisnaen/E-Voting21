import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { HttpError } from '../lib/http-error.js';

export function notFoundApi(_req: Request, res: Response): void {
  res.status(404).json({ message: 'Endpoint tidak ditemukan.', code: 'NOT_FOUND' });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message, code: err.code, details: err.details });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      message: err.issues[0]?.message ?? 'Data yang dikirim tidak valid.',
      code: 'VALIDATION_ERROR',
      details: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
    return;
  }
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran foto maksimal 3 MB.' : 'Berkas yang diunggah tidak valid.';
    res.status(400).json({ message, code: 'UPLOAD_INVALID' });
    return;
  }
  if ((err as { status?: number } | null)?.status === 404) {
    // Dari express.static (mis. /uploads/… yang tidak ada).
    res.status(404).json({ message: 'Berkas tidak ditemukan.', code: 'NOT_FOUND' });
    return;
  }
  const bodyErrorType = (err as { type?: string } | null)?.type;
  if (bodyErrorType === 'entity.parse.failed') {
    res.status(400).json({ message: 'Format data tidak valid.', code: 'BAD_JSON' });
    return;
  }
  if (bodyErrorType === 'entity.too.large') {
    res.status(413).json({ message: 'Data yang dikirim terlalu besar.', code: 'PAYLOAD_TOO_LARGE' });
    return;
  }

  console.error('[error]', err);
  res.status(500).json({
    message: 'Terjadi kesalahan pada server. Silakan coba beberapa saat lagi.',
    code: 'INTERNAL_ERROR',
  });
}
