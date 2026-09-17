import express, { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import { detectGradeLevel } from '../../lib/grade.js';
import { HttpError } from '../../lib/http-error.js';
import { hashPassword } from '../../lib/password.js';
import { isUniqueViolation, prisma } from '../../lib/prisma.js';
import { currentUser } from '../../middleware/auth.js';
import { AUDIT, recordAudit } from '../../services/audit.js';

export const adminStudentsRouter = Router();

const idParam = z.coerce.number().int().positive('ID tidak valid.');

const nis = z
  .string({ error: 'NIS wajib diisi.' })
  .trim()
  .min(3, 'NIS minimal 3 karakter.')
  .max(32, 'NIS maksimal 32 karakter.')
  .regex(/^[A-Za-z0-9._-]+$/, 'NIS hanya boleh berisi huruf, angka, titik, strip, atau garis bawah.');
const name = z.string({ error: 'Nama wajib diisi.' }).trim().min(2, 'Nama minimal 2 karakter.').max(120);
const classId = z.coerce.number({ error: 'Pilih kelas.' }).int('Pilih kelas.').positive('Pilih kelas.');
const accessCode = z
  .string({ error: 'Kode akses wajib diisi.' })
  .min(6, 'Kode akses minimal 6 karakter.')
  .max(128, 'Kode akses maksimal 128 karakter.');
const className = z
  .string({ error: 'Kelas wajib diisi.' })
  .trim()
  .min(1, 'Kelas wajib diisi.')
  .max(40, 'Nama kelas maksimal 40 karakter.')
  .transform((value) => value.replace(/\s+/g, ' '));

const createSchema = z.object({ nis, name, classId, password: accessCode });
const updateSchema = z.object({ nis, name, classId, password: accessCode.optional() });
const importSchema = z.object({
  students: z
    .array(z.object({ nis, name, className, password: accessCode }))
    .min(1, 'Berkas tidak berisi data siswa.')
    .max(1000, 'Maksimal 1000 siswa per permintaan impor.'),
  createMissingClasses: z.boolean().default(false),
});

const listQuery = z.object({
  q: z.string().trim().max(64).optional(),
  classId: z.coerce.number().int().positive().optional(),
  gradeLevel: z.enum(['10', '11', '12', 'none']).optional(),
  voted: z.enum(['all', 'yes', 'no']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(25),
});

const studentSelect = {
  id: true,
  nis: true,
  name: true,
  hasVoted: true,
  createdAt: true,
  schoolClass: { select: { id: true, name: true, gradeLevel: true } },
  candidacy: { select: { candidateNumber: true } },
} as const;

type StudentRow = Prisma.UserGetPayload<{ select: typeof studentSelect }>;

function toStudent({ schoolClass, candidacy, ...student }: StudentRow) {
  return {
    ...student,
    classId: schoolClass?.id ?? null,
    className: schoolClass?.name ?? null,
    gradeLevel: schoolClass?.gradeLevel ?? null,
    candidateNumber: candidacy?.candidateNumber ?? null,
  };
}

const DUPLICATE_NIS = 'NIS sudah terdaftar.';

async function findStudent(id: number) {
  const student = await prisma.user.findFirst({ where: { id, role: 'student' }, select: studentSelect });
  if (!student) throw new HttpError(404, 'Data siswa tidak ditemukan.', 'STUDENT_NOT_FOUND');
  return student;
}

async function assertClassExists(id: number) {
  if (!(await prisma.schoolClass.findUnique({ where: { id }, select: { id: true } }))) {
    throw new HttpError(400, 'Kelas yang dipilih tidak ditemukan.', 'VALIDATION_ERROR', [
      { path: 'classId', message: 'Kelas yang dipilih tidak ditemukan.' },
    ]);
  }
}

function duplicateNis(): HttpError {
  return new HttpError(409, DUPLICATE_NIS, 'DUPLICATE_NIS', [{ path: 'nis', message: DUPLICATE_NIS }]);
}

adminStudentsRouter.get('/', async (req, res) => {
  const query = listQuery.parse(req.query);
  const gradeFilter: Prisma.UserWhereInput =
    query.gradeLevel === undefined
      ? {}
      : { schoolClass: { gradeLevel: query.gradeLevel === 'none' ? null : Number(query.gradeLevel) } };
  const where: Prisma.UserWhereInput = {
    role: 'student',
    ...gradeFilter,
    ...(query.classId ? { classId: query.classId } : {}),
    ...(query.voted !== 'all' ? { hasVoted: query.voted === 'yes' } : {}),
    ...(query.q ? { OR: [{ nis: { contains: query.q } }, { name: { contains: query.q } }] } : {}),
  };
  const [total, students] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: studentSelect,
      orderBy: [{ schoolClass: { name: 'asc' } }, { name: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  res.json({ students: students.map(toStudent), total, page: query.page, pageSize: query.pageSize });
});

adminStudentsRouter.post('/', async (req, res) => {
  const admin = currentUser(req);
  const data = createSchema.parse(req.body);
  await assertClassExists(data.classId);
  try {
    const student = await prisma.user.create({
      data: {
        nis: data.nis,
        name: data.name,
        classId: data.classId,
        role: 'student',
        passwordHash: await hashPassword(data.password),
      },
      select: studentSelect,
    });
    await recordAudit({
      action: AUDIT.STUDENT_CREATED,
      status: 'success',
      userId: admin.id,
      actor: admin.nis,
      metadata: { studentNis: student.nis },
    });
    res.status(201).json({ student: toStudent(student) });
  } catch (err) {
    if (isUniqueViolation(err)) throw duplicateNis();
    throw err;
  }
});

adminStudentsRouter.put('/:id', async (req, res) => {
  const admin = currentUser(req);
  const id = idParam.parse(req.params.id);
  const data = updateSchema.parse(req.body);
  await findStudent(id);
  await assertClassExists(data.classId);
  try {
    const student = await prisma.user.update({
      where: { id },
      data: {
        nis: data.nis,
        name: data.name,
        classId: data.classId,
        // Kode akses baru → cabut semua sesi siswa tersebut.
        ...(data.password
          ? { passwordHash: await hashPassword(data.password), tokenVersion: { increment: 1 } }
          : {}),
      },
      select: studentSelect,
    });
    await recordAudit({
      action: data.password ? AUDIT.STUDENT_ACCESS_CODE_RESET : AUDIT.STUDENT_UPDATED,
      status: 'success',
      userId: admin.id,
      actor: admin.nis,
      metadata: { studentNis: student.nis },
    });
    res.json({ student: toStudent(student) });
  } catch (err) {
    if (isUniqueViolation(err)) throw duplicateNis();
    throw err;
  }
});

adminStudentsRouter.delete('/:id', async (req, res) => {
  const admin = currentUser(req);
  const id = idParam.parse(req.params.id);
  const student = await findStudent(id);
  if (student.hasVoted) {
    throw new HttpError(409, 'Siswa yang sudah memilih tidak dapat dihapus agar rekap suara tetap valid.', 'STUDENT_HAS_VOTED');
  }
  if (student.candidacy) {
    throw new HttpError(
      409,
      `Siswa ini terdaftar sebagai kandidat No. ${student.candidacy.candidateNumber}. Hapus dari Data Kandidat terlebih dahulu.`,
      'STUDENT_IS_CANDIDATE',
    );
  }
  await prisma.user.delete({ where: { id } });
  await recordAudit({
    action: AUDIT.STUDENT_DELETED,
    status: 'success',
    userId: admin.id,
    actor: admin.nis,
    metadata: { studentNis: student.nis },
  });
  res.status(204).end();
});

/**
 * Impor massal (CSV/Excel sudah diparse di klien). NIS yang sudah terdaftar dilewati.
 * Kelas dicocokkan berdasarkan nama; kelas yang belum ada dibuat bila `createMissingClasses`.
 */
adminStudentsRouter.post('/import', express.json({ limit: '1mb' }), async (req, res) => {
  const admin = currentUser(req);
  const { students, createMissingClasses } = importSchema.parse(req.body);
  const key = (value: string) => value.toLowerCase();

  // 1. Kelas
  const classNames = [...new Map(students.map((s) => [key(s.className), s.className])).values()];
  const findClasses = async () =>
    new Map(
      (await prisma.schoolClass.findMany({ where: { name: { in: classNames } }, select: { id: true, name: true } })).map(
        (c) => [key(c.name), c.id],
      ),
    );
  let classIds = await findClasses();
  const missingClasses = classNames.filter((name) => !classIds.has(key(name)));
  if (missingClasses.length && !createMissingClasses) {
    const list = missingClasses.slice(0, 10).join(', ') + (missingClasses.length > 10 ? ', …' : '');
    throw new HttpError(
      400,
      `Kelas belum terdaftar: ${list}. Tambahkan di Data Kelas atau aktifkan "Buat kelas yang belum ada".`,
      'UNKNOWN_CLASSES',
      { missingClasses },
    );
  }
  if (missingClasses.length) {
    await prisma.schoolClass.createMany({
      data: missingClasses.map((name) => ({ name, gradeLevel: detectGradeLevel(name) })),
      skipDuplicates: true,
    });
    classIds = await findClasses();
  }

  // 2. Siswa baru saja (NIS unik di berkas & belum terdaftar)
  const seen = new Set<string>();
  const unique = students.filter((s) => {
    if (seen.has(key(s.nis))) return false;
    seen.add(key(s.nis));
    return true;
  });
  const existing = await prisma.user.findMany({ where: { nis: { in: unique.map((s) => s.nis) } }, select: { nis: true } });
  const existingNis = new Set(existing.map((u) => key(u.nis)));
  const fresh = unique.filter((s) => !existingNis.has(key(s.nis)));

  const rows: Prisma.UserCreateManyInput[] = [];
  const CONCURRENCY = 8;
  for (let i = 0; i < fresh.length; i += CONCURRENCY) {
    const chunk = fresh.slice(i, i + CONCURRENCY);
    const hashed = await Promise.all(chunk.map((s) => hashPassword(s.password)));
    chunk.forEach((s, index) =>
      rows.push({
        nis: s.nis,
        name: s.name,
        classId: classIds.get(key(s.className))!,
        role: 'student',
        passwordHash: hashed[index]!,
      }),
    );
  }

  // Tanpa skipDuplicates: daftar NIS yang dikembalikan harus persis yang dibuat, karena klien
  // memakainya untuk mengunduh kode akses.
  try {
    if (rows.length) await prisma.user.createMany({ data: rows });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new HttpError(409, 'Sebagian NIS baru saja ditambahkan oleh proses lain. Ulangi impor.', 'IMPORT_CONFLICT');
    }
    throw err;
  }

  const result = {
    received: students.length,
    created: rows.length,
    skipped: students.length - rows.length,
    createdNis: rows.map((row) => row.nis),
    createdClasses: missingClasses,
  };
  await recordAudit({
    action: AUDIT.STUDENTS_IMPORTED,
    status: 'success',
    userId: admin.id,
    actor: admin.nis,
    metadata: {
      received: result.received,
      created: result.created,
      skipped: result.skipped,
      createdClasses: missingClasses.length,
    },
  });
  res.status(201).json(result);
});
