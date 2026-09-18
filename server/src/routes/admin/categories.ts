import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/http-error.js';
import { isUniqueViolation, prisma } from '../../lib/prisma.js';
import { currentUser } from '../../middleware/auth.js';
import { AUDIT, recordAudit } from '../../services/audit.js';
import { categoryOrderBy, serializeCategory } from '../../services/categories.js';
import { electionInProgress } from '../../services/election.js';

export const adminCategoriesRouter = Router();

const idParam = z.coerce.number().int().positive('ID tidak valid.');

const categorySchema = z.object({
  name: z
    .string({ error: 'Nama kategori wajib diisi.' })
    .trim()
    .min(2, 'Nama kategori minimal 2 karakter.')
    .max(80, 'Nama kategori maksimal 80 karakter.')
    .transform((value) => value.replace(/\s+/g, ' ')),
  description: z
    .string()
    .trim()
    .max(300, 'Deskripsi maksimal 300 karakter.')
    .nullish()
    .transform((value) => value || null),
  voterScope: z.enum(['all', 'student', 'teacher'], { error: 'Pilih siapa yang boleh memilih.' }),
  sortOrder: z.coerce.number({ error: 'Urutan harus angka.' }).int('Urutan harus bilangan bulat.').min(0).max(999).default(0),
});

const DUPLICATE_NAME = 'Nama kategori sudah dipakai.';

function duplicateName(): HttpError {
  return new HttpError(409, DUPLICATE_NAME, 'DUPLICATE_CATEGORY', [{ path: 'name', message: DUPLICATE_NAME }]);
}

async function findCategory(id: number) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw new HttpError(404, 'Kategori tidak ditemukan.', 'CATEGORY_NOT_FOUND');
  return category;
}

adminCategoriesRouter.get('/', async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: [...categoryOrderBy],
    include: { _count: { select: { candidates: true, votes: true } } },
  });
  res.json({
    categories: categories.map(({ _count, ...category }) => ({
      ...serializeCategory(category),
      candidateCount: _count.candidates,
      voteCount: _count.votes,
    })),
  });
});

adminCategoriesRouter.post('/', async (req, res) => {
  const admin = currentUser(req);
  const data = categorySchema.parse(req.body);
  if (await electionInProgress()) {
    throw new HttpError(409, 'Kategori tidak dapat ditambahkan saat masa pemungutan suara berlangsung.', 'ELECTION_IN_PROGRESS');
  }
  try {
    const category = await prisma.category.create({ data });
    await recordAudit({
      action: AUDIT.CATEGORY_CREATED,
      status: 'success',
      userId: admin.id,
      actor: admin.nis,
      metadata: { categoryId: category.id, name: category.name },
    });
    res.status(201).json({ category: serializeCategory(category) });
  } catch (err) {
    if (isUniqueViolation(err)) throw duplicateName();
    throw err;
  }
});

adminCategoriesRouter.put('/:id', async (req, res) => {
  const admin = currentUser(req);
  const id = idParam.parse(req.params.id);
  const data = categorySchema.parse(req.body);
  const before = await findCategory(id);
  // Nama, deskripsi & urutan boleh diperbaiki kapan saja; hak memilih dikunci selama pemungutan suara.
  if (before.voterScope !== data.voterScope && (await electionInProgress())) {
    throw new HttpError(
      409,
      'Siapa yang boleh memilih tidak dapat diubah saat masa pemungutan suara berlangsung.',
      'ELECTION_IN_PROGRESS',
    );
  }
  try {
    const category = await prisma.category.update({ where: { id }, data });
    await recordAudit({
      action: AUDIT.CATEGORY_UPDATED,
      status: 'success',
      userId: admin.id,
      actor: admin.nis,
      metadata: {
        categoryId: id,
        name: category.name,
        previousName: before.name === category.name ? undefined : before.name,
        voterScope: category.voterScope,
      },
    });
    res.json({ category: serializeCategory(category) });
  } catch (err) {
    if (isUniqueViolation(err)) throw duplicateName();
    throw err;
  }
});

adminCategoriesRouter.delete('/:id', async (req, res) => {
  const admin = currentUser(req);
  const id = idParam.parse(req.params.id);
  const category = await findCategory(id);
  if (await electionInProgress()) {
    throw new HttpError(409, 'Kategori tidak dapat dihapus saat masa pemungutan suara berlangsung.', 'ELECTION_IN_PROGRESS');
  }
  const [candidates, votes] = await Promise.all([
    prisma.candidate.count({ where: { categoryId: id } }),
    prisma.vote.count({ where: { categoryId: id } }),
  ]);
  if (votes > 0) {
    throw new HttpError(409, `Kategori ${category.name} sudah memiliki suara dan tidak dapat dihapus.`, 'CATEGORY_HAS_VOTES');
  }
  if (candidates > 0) {
    throw new HttpError(
      409,
      `Kategori ${category.name} masih memiliki ${candidates} kandidat. Hapus kandidatnya terlebih dahulu.`,
      'CATEGORY_NOT_EMPTY',
    );
  }
  await prisma.category.delete({ where: { id } });
  await recordAudit({
    action: AUDIT.CATEGORY_DELETED,
    status: 'success',
    userId: admin.id,
    actor: admin.nis,
    metadata: { categoryId: id, name: category.name },
  });
  res.status(204).end();
});
