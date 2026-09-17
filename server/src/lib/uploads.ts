import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { env } from '../env.js';
import { HttpError } from './http-error.js';

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

/** Menerima satu berkas di field `photo`, disimpan di memori untuk divalidasi dulu. */
export const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: 1 },
}).single('photo');

/** Deteksi dari magic bytes — `mimetype` dari klien tidak dipercaya. */
export function detectImageExtension(buffer: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp';
  }
  return null;
}

export async function saveImage(file: Express.Multer.File | undefined, folder: 'candidates' | 'hero'): Promise<string> {
  if (!file) throw new HttpError(400, 'Pilih berkas foto terlebih dahulu.', 'UPLOAD_MISSING');
  const extension = detectImageExtension(file.buffer);
  if (!extension) throw new HttpError(400, 'Format foto harus JPG, PNG, atau WEBP.', 'UPLOAD_INVALID');

  const directory = path.join(env.uploadRoot, folder);
  const filename = `${randomUUID()}.${extension}`;
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), file.buffer);
  return `/uploads/${folder}/${filename}`;
}

/** Menghapus berkas lama; hanya di dalam folder upload. */
export async function removeUpload(publicUrl: string | null | undefined): Promise<void> {
  if (!publicUrl?.startsWith('/uploads/')) return;
  const target = path.resolve(env.uploadRoot, publicUrl.slice('/uploads/'.length));
  if (!target.startsWith(env.uploadRoot + path.sep)) return;
  await rm(target, { force: true });
}
