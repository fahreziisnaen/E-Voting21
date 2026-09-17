import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/http-error.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import { setAuthCookies } from '../../lib/tokens.js';
import { currentUser, requireAuth, requireRole } from '../../middleware/auth.js';
import { AUDIT, recordAudit } from '../../services/audit.js';
import { adminCandidatesRouter } from './candidates.js';
import { adminClassesRouter } from './classes.js';
import { adminElectionRouter } from './election.js';
import { adminReportsRouter } from './reports.js';
import { adminStudentsRouter } from './students.js';

export const adminRouter = Router();

// Semua endpoint /api/admin/* hanya untuk panitia.
adminRouter.use(requireAuth, requireRole('admin'));

adminRouter.use('/', adminReportsRouter);
adminRouter.use('/candidates', adminCandidatesRouter);
adminRouter.use('/students', adminStudentsRouter);
adminRouter.use('/classes', adminClassesRouter);
adminRouter.use('/election', adminElectionRouter);

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Kata sandi saat ini wajib diisi.').max(128),
    newPassword: z.string().min(10, 'Kata sandi baru minimal 10 karakter.').max(128),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'Kata sandi baru harus berbeda dari kata sandi saat ini.',
    path: ['newPassword'],
  });

adminRouter.put('/account/password', async (req, res) => {
  const admin = currentUser(req);
  const { currentPassword, newPassword } = passwordSchema.parse(req.body);
  const account = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
  if (!(await verifyPassword(account.passwordHash, currentPassword))) {
    await recordAudit({ action: AUDIT.ADMIN_PASSWORD_CHANGED, status: 'failed', userId: admin.id, actor: admin.nis });
    throw new HttpError(400, 'Kata sandi saat ini salah.', 'INVALID_PASSWORD');
  }
  const updated = await prisma.user.update({
    where: { id: admin.id },
    data: { passwordHash: await hashPassword(newPassword), tokenVersion: { increment: 1 } },
  });
  // Sesi lain dicabut; sesi yang sedang dipakai diterbitkan ulang.
  setAuthCookies(res, updated);
  await recordAudit({ action: AUDIT.ADMIN_PASSWORD_CHANGED, status: 'success', userId: admin.id, actor: admin.nis });
  res.json({ message: 'Kata sandi berhasil diperbarui.' });
});
