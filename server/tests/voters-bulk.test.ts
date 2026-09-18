import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { createCandidates, createClass, createUser, loginAs, PASSWORD, resetDatabase, setElection } from './helpers.js';

beforeEach(async () => {
  await resetDatabase();
  await setElection({ status: 'open' });
  await createUser('admin.uji', 'admin');
});

afterAll(() => prisma.$disconnect());

describe('ubah massal pemilih', () => {
  it('memindahkan kelas dan mengganti kode akses sekaligus untuk siswa terpilih', async () => {
    const kelasBaru = await createClass('XII IPS 3', 12);
    const a = await createUser('7301');
    const b = await createUser('7302');
    const lain = await createUser('7303');
    const { agent, token } = await loginAs('admin.uji');

    const res = await agent
      .post('/api/admin/students/bulk-update')
      .set('x-csrf-token', token)
      .send({
        ids: [a.id, b.id],
        classId: kelasBaru.id,
        codes: [
          { id: a.id, password: 'kode-baru-a' },
          { id: b.id, password: 'kode-baru-b' },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ updated: 2, accessCodesReset: 2, classChanged: 2 });

    const setelah = await prisma.user.findMany({ where: { id: { in: [a.id, b.id, lain.id] } }, orderBy: { nis: 'asc' } });
    expect(setelah.map((u) => u.classId)).toEqual([kelasBaru.id, kelasBaru.id, lain.classId]);

    // Kode lama tidak berlaku lagi, kode baru berhasil.
    expect((await loginAs('7301', PASSWORD)).login.status).toBe(401);
    expect((await loginAs('7301', 'kode-baru-a')).login.status).toBe(200);
    expect((await loginAs('7303', PASSWORD)).login.status).toBe(200);
    expect(await prisma.auditLog.count({ where: { action: 'student.access_code_reset' } })).toBe(1);
  });

  it('guru hanya bisa diubah kode aksesnya, bukan kelas', async () => {
    const kelas = await createClass('XI IPA 4', 11);
    const guru = await createUser('guru.satu', 'teacher');
    const { agent, token } = await loginAs('admin.uji');

    const tolak = await agent
      .post('/api/admin/teachers/bulk-update')
      .set('x-csrf-token', token)
      .send({ ids: [guru.id], classId: kelas.id });
    expect(tolak.status).toBe(400);

    const ok = await agent
      .post('/api/admin/teachers/bulk-update')
      .set('x-csrf-token', token)
      .send({ ids: [guru.id], codes: [{ id: guru.id, password: 'kode-guru-baru' }] });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ updated: 1, accessCodesReset: 1, classChanged: 0 });
    expect((await loginAs('guru.satu', 'kode-guru-baru')).login.status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: guru.id } })).classId).toBeNull();
  });

  it('menolak pilihan kosong, perubahan kosong, dan id dari peran lain', async () => {
    const guru = await createUser('guru.dua', 'teacher');
    const siswa = await createUser('7304');
    const { agent, token } = await loginAs('admin.uji');
    const post = (body: object) => agent.post('/api/admin/students/bulk-update').set('x-csrf-token', token).send(body);

    expect((await post({ ids: [], classId: siswa.classId })).status).toBe(400);
    expect((await post({ ids: [siswa.id] })).status).toBe(400);
    // Guru tidak ikut terpengaruh endpoint siswa.
    const salahPeran = await post({ ids: [guru.id], codes: [{ id: guru.id, password: 'kode-lain-lagi' }] });
    expect(salahPeran.status).toBe(404);
    expect((await loginAs('guru.dua', PASSWORD)).login.status).toBe(200);
  });
});

describe('hapus massal pemilih', () => {
  it('menghapus yang bisa dihapus dan melewati pemilih yang sudah memilih atau menjadi kandidat', async () => {
    const [kandidat] = await createCandidates('Ketua OSIS');
    const kandidatUser = await prisma.user.findUniqueOrThrow({ where: { id: kandidat!.userId } });
    const sudahMemilih = await createUser('7401');
    const belumMemilih = await createUser('7402');
    const jugaBelum = await createUser('7403');

    const session = await loginAs(sudahMemilih.nis);
    expect((await session.agent.post('/api/votes').set('x-csrf-token', session.token).send({ candidateId: kandidat!.id })).status).toBe(201);

    const { agent, token } = await loginAs('admin.uji');
    const res = await agent
      .post('/api/admin/students/bulk-delete')
      .set('x-csrf-token', token)
      .send({ ids: [sudahMemilih.id, belumMemilih.id, jugaBelum.id, kandidatUser.id] });

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(2);
    expect(res.body.skipped).toHaveLength(2);
    expect(res.body.skipped.map((item: { reason: string }) => item.reason).sort()).toEqual(['kandidat', 'sudah_memilih']);

    expect(await prisma.user.findUnique({ where: { id: belumMemilih.id } })).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: sudahMemilih.id } })).not.toBeNull();
    expect(await prisma.user.findUnique({ where: { id: kandidatUser.id } })).not.toBeNull();
    expect(await prisma.vote.count()).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'student.bulk_deleted' } })).toBe(1);
  });

  it('hanya panitia yang boleh memakai aksi massal', async () => {
    const siswa = await createUser('7501');
    const session = await loginAs(siswa.nis);
    const res = await session.agent.post('/api/admin/students/bulk-delete').set('x-csrf-token', session.token).send({ ids: [siswa.id] });
    expect(res.status).toBe(403);
    expect(await prisma.user.findUnique({ where: { id: siswa.id } })).not.toBeNull();
  });
});
