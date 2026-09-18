import express, { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import { detectGradeLevel } from '../../lib/grade.js';
import { HttpError } from '../../lib/http-error.js';
import { hashPassword } from '../../lib/password.js';
import { isUniqueViolation, prisma } from '../../lib/prisma.js';
import { currentUser } from '../../middleware/auth.js';
import { AUDIT, recordAudit, type AuditAction } from '../../services/audit.js';

type VoterRole = 'student' | 'teacher';

const COPY: Record<
  VoterRole,
  {
    id: string;
    noun: string;
    audit: { created: AuditAction; updated: AuditAction; deleted: AuditAction; reset: AuditAction; imported: AuditAction };
  }
> = {
  student: {
    id: 'NIS',
    noun: 'Siswa',
    audit: {
      created: AUDIT.STUDENT_CREATED,
      updated: AUDIT.STUDENT_UPDATED,
      deleted: AUDIT.STUDENT_DELETED,
      reset: AUDIT.STUDENT_ACCESS_CODE_RESET,
      imported: AUDIT.STUDENTS_IMPORTED,
    },
  },
  teacher: {
    id: 'Username',
    noun: 'Guru',
    audit: {
      created: AUDIT.TEACHER_CREATED,
      updated: AUDIT.TEACHER_UPDATED,
      deleted: AUDIT.TEACHER_DELETED,
      reset: AUDIT.TEACHER_ACCESS_CODE_RESET,
      imported: AUDIT.TEACHERS_IMPORTED,
    },
  },
};

const idParam = z.coerce.number().int().positive('ID tidak valid.');

const accessCode = z
  .string({ error: 'Kode akses wajib diisi.' })
  .min(6, 'Kode akses minimal 6 karakter.')
  .max(128, 'Kode akses maksimal 128 karakter.');
const personName = z.string({ error: 'Nama wajib diisi.' }).trim().min(2, 'Nama minimal 2 karakter.').max(120);
const classIdField = z.coerce.number({ error: 'Pilih kelas.' }).int('Pilih kelas.').positive('Pilih kelas.');
const classNameField = z
  .string({ error: 'Kelas wajib diisi.' })
  .trim()
  .min(1, 'Kelas wajib diisi.')
  .max(40, 'Nama kelas maksimal 40 karakter.')
  .transform((value) => value.replace(/\s+/g, ' '));

const voterSelect = {
  id: true,
  nis: true,
  name: true,
  createdAt: true,
  schoolClass: { select: { id: true, name: true, gradeLevel: true } },
  candidacies: { select: { candidateNumber: true, category: { select: { id: true, name: true } } } },
  _count: { select: { votes: true } },
} as const;

type VoterRow = Prisma.UserGetPayload<{ select: typeof voterSelect }>;

function toVoter({ schoolClass, candidacies, _count, ...voter }: VoterRow) {
  return {
    ...voter,
    classId: schoolClass?.id ?? null,
    className: schoolClass?.name ?? null,
    gradeLevel: schoolClass?.gradeLevel ?? null,
    /** Jumlah kategori yang sudah dipilih (tanpa isi pilihannya). */
    votedCount: _count.votes,
    candidacies: candidacies.map((c) => ({ categoryId: c.category.id, categoryName: c.category.name, candidateNumber: c.candidateNumber })),
  };
}

/**
 * Pengelolaan pemilih per peran. Siswa wajib memiliki kelas; guru tidak memiliki kelas.
 * Dipasang di /api/admin/students dan /api/admin/teachers.
 */
export function createVotersRouter(role: VoterRole) {
  const router = Router();
  const copy = COPY[role];
  const isStudent = role === 'student';

  const identifier = z
    .string({ error: `${copy.id} wajib diisi.` })
    .trim()
    .min(3, `${copy.id} minimal 3 karakter.`)
    .max(32, `${copy.id} maksimal 32 karakter.`)
    .regex(/^[A-Za-z0-9._-]+$/, `${copy.id} hanya boleh berisi huruf, angka, titik, strip, atau garis bawah.`);

  const createSchema = z.object({
    nis: identifier,
    name: personName,
    classId: isStudent ? classIdField : z.null().optional(),
    password: accessCode,
  });
  const updateSchema = createSchema.extend({ password: accessCode.optional() });
  const importSchema = z.object({
    rows: z
      .array(z.object({ nis: identifier, name: personName, className: isStudent ? classNameField : z.string().optional(), password: accessCode }))
      .min(1, 'Berkas tidak berisi data.')
      .max(1000, 'Maksimal 1000 baris per permintaan impor.'),
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

  const duplicate = () =>
    new HttpError(409, `${copy.id} sudah terdaftar.`, 'DUPLICATE_NIS', [{ path: 'nis', message: `${copy.id} sudah terdaftar.` }]);

  async function findVoter(id: number) {
    const voter = await prisma.user.findFirst({ where: { id, role }, select: voterSelect });
    if (!voter) throw new HttpError(404, `Data ${copy.noun.toLowerCase()} tidak ditemukan.`, 'VOTER_NOT_FOUND');
    return voter;
  }

  async function assertClassExists(classId: number | null | undefined) {
    if (!isStudent) return;
    if (!classId || !(await prisma.schoolClass.findUnique({ where: { id: classId }, select: { id: true } }))) {
      throw new HttpError(400, 'Kelas yang dipilih tidak ditemukan.', 'VALIDATION_ERROR', [
        { path: 'classId', message: 'Kelas yang dipilih tidak ditemukan.' },
      ]);
    }
  }

  router.get('/', async (req, res) => {
    const query = listQuery.parse(req.query);
    const where: Prisma.UserWhereInput = {
      role,
      ...(isStudent && query.gradeLevel
        ? { schoolClass: { gradeLevel: query.gradeLevel === 'none' ? null : Number(query.gradeLevel) } }
        : {}),
      ...(isStudent && query.classId ? { classId: query.classId } : {}),
      ...(query.voted === 'yes' ? { votes: { some: {} } } : query.voted === 'no' ? { votes: { none: {} } } : {}),
      ...(query.q ? { OR: [{ nis: { contains: query.q } }, { name: { contains: query.q } }] } : {}),
    };
    const [total, voters, eligibleCategories] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: voterSelect,
        orderBy: isStudent ? [{ schoolClass: { name: 'asc' } }, { name: 'asc' }] : [{ name: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.category.count({ where: { voterScope: { in: ['all', role] } } }),
    ]);
    res.json({ voters: voters.map(toVoter), total, page: query.page, pageSize: query.pageSize, eligibleCategories });
  });

  router.post('/', async (req, res) => {
    const admin = currentUser(req);
    const data = createSchema.parse(req.body);
    await assertClassExists(data.classId);
    try {
      const voter = await prisma.user.create({
        data: {
          nis: data.nis,
          name: data.name,
          role,
          classId: isStudent ? data.classId : null,
          passwordHash: await hashPassword(data.password),
        },
        select: voterSelect,
      });
      await recordAudit({
        action: copy.audit.created,
        status: 'success',
        userId: admin.id,
        actor: admin.nis,
        metadata: { voterNis: voter.nis },
      });
      res.status(201).json({ voter: toVoter(voter) });
    } catch (err) {
      if (isUniqueViolation(err)) throw duplicate();
      throw err;
    }
  });

  router.put('/:id', async (req, res) => {
    const admin = currentUser(req);
    const id = idParam.parse(req.params.id);
    const data = updateSchema.parse(req.body);
    await findVoter(id);
    await assertClassExists(data.classId);
    try {
      const voter = await prisma.user.update({
        where: { id },
        data: {
          nis: data.nis,
          name: data.name,
          classId: isStudent ? data.classId : null,
          // Kode akses baru → cabut semua sesi akun tersebut.
          ...(data.password ? { passwordHash: await hashPassword(data.password), tokenVersion: { increment: 1 } } : {}),
        },
        select: voterSelect,
      });
      await recordAudit({
        action: data.password ? copy.audit.reset : copy.audit.updated,
        status: 'success',
        userId: admin.id,
        actor: admin.nis,
        metadata: { voterNis: voter.nis },
      });
      res.json({ voter: toVoter(voter) });
    } catch (err) {
      if (isUniqueViolation(err)) throw duplicate();
      throw err;
    }
  });

  router.delete('/:id', async (req, res) => {
    const admin = currentUser(req);
    const id = idParam.parse(req.params.id);
    const voter = await findVoter(id);
    if (voter._count.votes > 0) {
      throw new HttpError(
        409,
        `${copy.noun} yang sudah memilih tidak dapat dihapus agar rekap suara tetap valid.`,
        'VOTER_HAS_VOTED',
      );
    }
    if (voter.candidacies.length > 0) {
      const list = voter.candidacies.map((c) => `${c.category.name} No. ${c.candidateNumber}`).join(', ');
      throw new HttpError(
        409,
        `${copy.noun} ini terdaftar sebagai kandidat (${list}). Hapus dari Data Kandidat terlebih dahulu.`,
        'VOTER_IS_CANDIDATE',
      );
    }
    await prisma.user.delete({ where: { id } });
    await recordAudit({
      action: copy.audit.deleted,
      status: 'success',
      userId: admin.id,
      actor: admin.nis,
      metadata: { voterNis: voter.nis },
    });
    res.status(204).end();
  });

  /**
   * Impor massal (CSV/Excel sudah diparse di klien). NIS/username yang sudah terdaftar dilewati.
   * Untuk siswa, kelas dicocokkan berdasarkan nama; yang belum ada dibuat bila `createMissingClasses`.
   */
  router.post('/import', express.json({ limit: '1mb' }), async (req, res) => {
    const admin = currentUser(req);
    const { rows: input, createMissingClasses } = importSchema.parse(req.body);
    const key = (value: string) => value.toLowerCase();

    let classIds = new Map<string, number>();
    let missingClasses: string[] = [];
    if (isStudent) {
      const classNames = [...new Map(input.map((row) => [key(row.className!), row.className!])).values()];
      const findClasses = async () =>
        new Map(
          (await prisma.schoolClass.findMany({ where: { name: { in: classNames } }, select: { id: true, name: true } })).map(
            (c) => [key(c.name), c.id],
          ),
        );
      classIds = await findClasses();
      missingClasses = classNames.filter((name) => !classIds.has(key(name)));
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
    }

    const seen = new Set<string>();
    const unique = input.filter((row) => {
      if (seen.has(key(row.nis))) return false;
      seen.add(key(row.nis));
      return true;
    });
    const existing = await prisma.user.findMany({ where: { nis: { in: unique.map((row) => row.nis) } }, select: { nis: true } });
    const existingNis = new Set(existing.map((u) => key(u.nis)));
    const fresh = unique.filter((row) => !existingNis.has(key(row.nis)));

    const data: Prisma.UserCreateManyInput[] = [];
    const CONCURRENCY = 8;
    for (let i = 0; i < fresh.length; i += CONCURRENCY) {
      const chunk = fresh.slice(i, i + CONCURRENCY);
      const hashed = await Promise.all(chunk.map((row) => hashPassword(row.password)));
      chunk.forEach((row, index) =>
        data.push({
          nis: row.nis,
          name: row.name,
          role,
          classId: isStudent ? classIds.get(key(row.className!))! : null,
          passwordHash: hashed[index]!,
        }),
      );
    }

    // Tanpa skipDuplicates: daftar yang dikembalikan harus persis yang dibuat (dipakai untuk unduh kode akses).
    try {
      if (data.length) await prisma.user.createMany({ data });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new HttpError(409, `Sebagian ${copy.id} baru saja ditambahkan oleh proses lain. Ulangi impor.`, 'IMPORT_CONFLICT');
      }
      throw err;
    }

    const result = {
      received: input.length,
      created: data.length,
      skipped: input.length - data.length,
      createdNis: data.map((row) => row.nis),
      createdClasses: missingClasses,
    };
    await recordAudit({
      action: copy.audit.imported,
      status: 'success',
      userId: admin.id,
      actor: admin.nis,
      metadata: { received: result.received, created: result.created, skipped: result.skipped, createdClasses: missingClasses.length },
    });
    res.status(201).json(result);
  });

  return router;
}
