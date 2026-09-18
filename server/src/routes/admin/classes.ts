import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/http-error.js';
import { isUniqueViolation, prisma } from '../../lib/prisma.js';
import { currentUser } from '../../middleware/auth.js';
import { AUDIT, recordAudit } from '../../services/audit.js';

export const adminClassesRouter = Router();

const idParam = z.coerce.number().int().positive('ID tidak valid.');

const classSchema = z.object({
  name: z
    .string({ error: 'Nama kelas wajib diisi.' })
    .trim()
    .min(1, 'Nama kelas wajib diisi.')
    .max(40, 'Nama kelas maksimal 40 karakter.')
    .transform((value) => value.replace(/\s+/g, ' ')),
  gradeLevel: z.union([z.literal(10), z.literal(11), z.literal(12), z.null()], { error: 'Tingkat tidak valid.' }),
});

const DUPLICATE_NAME = 'Nama kelas sudah dipakai.';

async function findClass(id: number) {
  const schoolClass = await prisma.schoolClass.findUnique({ where: { id } });
  if (!schoolClass) throw new HttpError(404, 'Kelas tidak ditemukan.', 'CLASS_NOT_FOUND');
  return schoolClass;
}

/** Daftar kelas beserta jumlah siswa dan partisipasi (agregat, tanpa pilihan kandidat). */
adminClassesRouter.get('/', async (_req, res) => {
  const [classes, voted] = await Promise.all([
    prisma.schoolClass.findMany({
      orderBy: [{ gradeLevel: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
      include: { _count: { select: { students: true } } },
    }),
    prisma.user.groupBy({
      by: ['classId'],
      // Siswa yang sudah memilih di minimal satu kategori.
      where: { role: 'student', classId: { not: null }, votes: { some: {} } },
      _count: { _all: true },
    }),
  ]);
  const votedByClass = new Map(voted.map((row) => [row.classId, row._count._all]));
  res.json({
    classes: classes.map(({ _count, ...schoolClass }) => ({
      id: schoolClass.id,
      name: schoolClass.name,
      gradeLevel: schoolClass.gradeLevel,
      studentCount: _count.students,
      votedCount: votedByClass.get(schoolClass.id) ?? 0,
    })),
  });
});

adminClassesRouter.post('/', async (req, res) => {
  const admin = currentUser(req);
  const data = classSchema.parse(req.body);
  try {
    const schoolClass = await prisma.schoolClass.create({ data });
    await recordAudit({
      action: AUDIT.CLASS_CREATED,
      status: 'success',
      userId: admin.id,
      actor: admin.nis,
      metadata: { name: schoolClass.name },
    });
    res.status(201).json({ class: schoolClass });
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, DUPLICATE_NAME, 'DUPLICATE_CLASS', [{ path: 'name', message: DUPLICATE_NAME }]);
    throw err;
  }
});

adminClassesRouter.put('/:id', async (req, res) => {
  const admin = currentUser(req);
  const id = idParam.parse(req.params.id);
  const data = classSchema.parse(req.body);
  const before = await findClass(id);
  try {
    // Nama kelas siswa ikut berubah otomatis karena siswa merujuk ke kelas lewat relasi.
    const schoolClass = await prisma.schoolClass.update({ where: { id }, data });
    await recordAudit({
      action: AUDIT.CLASS_UPDATED,
      status: 'success',
      userId: admin.id,
      actor: admin.nis,
      metadata: { name: schoolClass.name, previousName: before.name === schoolClass.name ? undefined : before.name },
    });
    res.json({ class: schoolClass });
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, DUPLICATE_NAME, 'DUPLICATE_CLASS', [{ path: 'name', message: DUPLICATE_NAME }]);
    throw err;
  }
});

adminClassesRouter.delete('/:id', async (req, res) => {
  const admin = currentUser(req);
  const id = idParam.parse(req.params.id);
  const schoolClass = await findClass(id);
  const students = await prisma.user.count({ where: { classId: id } });
  if (students > 0) {
    throw new HttpError(
      409,
      `Kelas ${schoolClass.name} masih berisi ${students} siswa. Pindahkan atau hapus siswanya terlebih dahulu.`,
      'CLASS_NOT_EMPTY',
    );
  }
  await prisma.schoolClass.delete({ where: { id } });
  await recordAudit({
    action: AUDIT.CLASS_DELETED,
    status: 'success',
    userId: admin.id,
    actor: admin.nis,
    metadata: { name: schoolClass.name },
  });
  res.status(204).end();
});
