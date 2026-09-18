import express, { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/http-error.js';
import { verifyPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import { wibDateKey } from '../../lib/time.js';
import { setAuthCookies } from '../../lib/tokens.js';
import { currentUser } from '../../middleware/auth.js';
import { AUDIT, recordAudit, type AuditAction } from '../../services/audit.js';
import { createBackup, factoryReset, parseBackup, restoreBackup, summarizeBackup } from '../../services/backup.js';
import { computeElectionPhase, getElectionSettings, isVotingInProgress } from '../../services/election.js';

export const adminMaintenanceRouter = Router();

// Berkas cadangan bisa berisi ribuan baris; endpoint ini memakai parser sendiri (lihat app.ts).
const backupBody = express.json({ limit: '25mb' });

const confirmation = (word: string) =>
  z.object({
    password: z.string({ error: 'Kata sandi panitia wajib diisi.' }).min(1, 'Kata sandi panitia wajib diisi.').max(128),
    confirm: z.literal(word, { error: `Ketik ${word} untuk melanjutkan.` }),
  });

const restoreSchema = confirmation('PULIHKAN').extend({ backup: z.unknown() });
const resetSchema = confirmation('RESET');

/** Aksi merusak: wajib kata sandi panitia yang sedang masuk, dan dicatat di audit log walau gagal. */
async function assertPassword(adminId: number, actor: string, password: string, action: AuditAction) {
  const account = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
  if (!(await verifyPassword(account.passwordHash, password))) {
    await recordAudit({ action, status: 'failed', userId: adminId, actor, metadata: { reason: 'invalid_password' } });
    throw new HttpError(400, 'Kata sandi panitia salah.', 'INVALID_PASSWORD');
  }
  return account;
}

/** Menolak aksi merusak selama pemungutan suara berjalan agar suara tidak hilang karena salah klik. */
async function assertVotingNotRunning() {
  const settings = await getElectionSettings();
  if (isVotingInProgress(computeElectionPhase(settings))) {
    throw new HttpError(
      409,
      'Tutup dulu pemungutan suara di menu Jadwal Voting sebelum memulihkan cadangan atau mereset data.',
      'ELECTION_IN_PROGRESS',
    );
  }
}

adminMaintenanceRouter.get('/backup', async (req, res) => {
  const admin = currentUser(req);
  const backup = await createBackup();
  await recordAudit({
    action: AUDIT.BACKUP_CREATED,
    status: 'success',
    userId: admin.id,
    actor: admin.nis,
    metadata: { users: backup.users.length, votes: backup.votes.length },
  });
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="cadangan-evoting-${wibDateKey(new Date())}.json"`);
  res.send(JSON.stringify(backup));
});

adminMaintenanceRouter.post('/restore', backupBody, async (req, res) => {
  const admin = currentUser(req);
  const { password, backup: raw } = restoreSchema.parse(req.body);
  await assertPassword(admin.id, admin.nis, password, AUDIT.BACKUP_RESTORED);
  await assertVotingNotRunning();

  const backup = parseBackup(raw);
  const summary = await restoreBackup(backup);
  // Audit dicatat setelah pemulihan agar ikut tersimpan di database yang baru.
  await recordAudit({
    action: AUDIT.BACKUP_RESTORED,
    status: 'success',
    actor: admin.nis,
    metadata: { backupCreatedAt: summary.createdAt, users: backup.users.length, votes: backup.votes.length },
  });
  res.json({ message: 'Data berhasil dipulihkan dari berkas cadangan. Silakan masuk kembali.', summary });
});

adminMaintenanceRouter.post('/factory-reset', async (req, res) => {
  const admin = currentUser(req);
  const { password } = resetSchema.parse(req.body);
  await assertPassword(admin.id, admin.nis, password, AUDIT.FACTORY_RESET);
  await assertVotingNotRunning();

  const account = await factoryReset(admin.id);
  // Akun panitia dipertahankan, tetapi sesi lain dicabut — sesi ini diterbitkan ulang.
  setAuthCookies(res, account);
  await recordAudit({ action: AUDIT.FACTORY_RESET, status: 'success', userId: account.id, actor: account.nis });
  res.json({ message: 'Seluruh data pemilihan dihapus. Aplikasi kembali seperti baru dipasang.' });
});

/** Ringkasan isi berkas cadangan tanpa mengubah apa pun (untuk pratinjau sebelum konfirmasi). */
adminMaintenanceRouter.post('/restore/preview', backupBody, async (req, res) => {
  res.json({ summary: summarizeBackup(parseBackup(req.body?.backup)) });
});
