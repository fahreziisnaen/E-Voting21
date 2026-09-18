import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { app, createCandidates, createUser, loginAs, resetDatabase, setElection } from './helpers.js';

beforeEach(async () => {
  await resetDatabase();
  await setElection({ status: 'closed' });
  await createUser('admin.uji', 'admin');
});

afterAll(() => prisma.$disconnect());

/** Satu pemilih memberikan suara agar cadangan memuat data di semua tabel. */
async function seedElectionData() {
  const [kandidat] = await createCandidates('Ketua OSIS');
  const voter = await createUser('7100');
  await createUser('guru.uji', 'teacher');
  await setElection({ status: 'open' });
  const session = await loginAs(voter.nis);
  const vote = await session.agent.post('/api/votes').set('x-csrf-token', session.token).send({ candidateId: kandidat!.id });
  expect(vote.status).toBe(201);
  await setElection({ status: 'closed' });
  return { candidateId: kandidat!.id, voterId: voter.id, receiptCode: vote.body.vote.receiptCode as string };
}

describe('cadangan & pemulihan', () => {
  it('cadangan memuat seluruh data dan dapat dipulihkan persis setelah data dihapus', async () => {
    const { receiptCode } = await seedElectionData();
    const { agent, token } = await loginAs('admin.uji');

    const download = await agent.get('/api/admin/backup');
    expect(download.status).toBe(200);
    expect(download.headers['content-disposition']).toMatch(/attachment; filename="cadangan-evoting-\d{4}-\d{2}-\d{2}\.json"/);
    const backup = JSON.parse(download.text);
    expect(backup).toMatchObject({ app: 'evoting-osis-sman21', version: 1 });
    expect(backup.votes).toHaveLength(1);
    expect(backup.categories).toHaveLength(1);
    expect(backup.election.status).toBe('closed');

    // Pratinjau tidak mengubah apa pun.
    const preview = await agent.post('/api/admin/restore/preview').set('x-csrf-token', token).send({ backup });
    expect(preview.status).toBe(200);
    expect(preview.body.summary).toMatchObject({ votes: 1, candidates: 2, teachers: 1, admins: 1 });
    expect(await prisma.vote.count()).toBe(1);

    // Hapus sebagian data, lalu pulihkan.
    await prisma.vote.deleteMany();
    await prisma.candidate.deleteMany();
    expect(await prisma.candidate.count()).toBe(0);

    const restore = await agent
      .post('/api/admin/restore')
      .set('x-csrf-token', token)
      .send({ backup, password: 'kode-akses-uji', confirm: 'PULIHKAN' });
    expect(restore.status).toBe(200);
    expect(restore.body.summary).toMatchObject({ votes: 1, classes: 1 });

    expect(await prisma.candidate.count()).toBe(2);
    const restored = await prisma.vote.findFirstOrThrow();
    expect(restored.receiptCode).toBe(receiptCode);
    expect(await prisma.auditLog.count({ where: { action: 'backup.restored' } })).toBe(1);
    // Panitia tetap bisa dipakai untuk masuk setelah pemulihan.
    expect((await loginAs('admin.uji')).login.status).toBe(200);
  });

  it('menolak kata sandi salah, berkas asing, dan pemulihan saat pemungutan suara berjalan', async () => {
    await seedElectionData();
    const { agent, token } = await loginAs('admin.uji');
    const backup = JSON.parse((await agent.get('/api/admin/backup')).text);

    const wrongPassword = await agent
      .post('/api/admin/restore')
      .set('x-csrf-token', token)
      .send({ backup, password: 'salah-sekali', confirm: 'PULIHKAN' });
    expect(wrongPassword.status).toBe(400);
    expect(wrongPassword.body.code).toBe('INVALID_PASSWORD');
    expect(await prisma.auditLog.count({ where: { action: 'backup.restored', status: 'failed' } })).toBe(1);

    const wrongConfirm = await agent
      .post('/api/admin/restore')
      .set('x-csrf-token', token)
      .send({ backup, password: 'kode-akses-uji', confirm: 'pulihkan' });
    expect(wrongConfirm.status).toBe(400);

    const foreign = await agent
      .post('/api/admin/restore')
      .set('x-csrf-token', token)
      .send({ backup: { app: 'aplikasi-lain', version: 1 }, password: 'kode-akses-uji', confirm: 'PULIHKAN' });
    expect(foreign.status).toBe(400);
    expect(foreign.body.code).toBe('BACKUP_INVALID');

    await setElection({ status: 'open' });
    const running = await agent
      .post('/api/admin/restore')
      .set('x-csrf-token', token)
      .send({ backup, password: 'kode-akses-uji', confirm: 'PULIHKAN' });
    expect(running.status).toBe(409);
    expect(running.body.code).toBe('ELECTION_IN_PROGRESS');
    expect(await prisma.vote.count()).toBe(1);
  });

  it('cadangan dengan relasi rusak ditolak sebelum menyentuh database', async () => {
    await seedElectionData();
    const { agent, token } = await loginAs('admin.uji');
    const backup = JSON.parse((await agent.get('/api/admin/backup')).text);
    backup.categories = [];

    const res = await agent
      .post('/api/admin/restore')
      .set('x-csrf-token', token)
      .send({ backup, password: 'kode-akses-uji', confirm: 'PULIHKAN' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BACKUP_INVALID');
    expect(await prisma.category.count()).toBe(1);
  });
});

describe('reset pabrik', () => {
  it('mengosongkan seluruh data, menyisakan akun panitia dan jadwal draf', async () => {
    await seedElectionData();
    const { agent, token } = await loginAs('admin.uji');

    const res = await agent.post('/api/admin/factory-reset').set('x-csrf-token', token).send({ password: 'kode-akses-uji', confirm: 'RESET' });
    expect(res.status).toBe(200);

    expect(await prisma.vote.count()).toBe(0);
    expect(await prisma.candidate.count()).toBe(0);
    expect(await prisma.category.count()).toBe(0);
    expect(await prisma.schoolClass.count()).toBe(0);
    expect(await prisma.user.count()).toBe(1);
    const admin = await prisma.user.findFirstOrThrow();
    expect(admin).toMatchObject({ nis: 'admin.uji', role: 'admin' });
    const settings = await prisma.electionSettings.findUniqueOrThrow({ where: { id: 1 } });
    expect(settings.status).toBe('draft');

    // Sesi panitia yang menjalankan reset tetap hidup (cookie diterbitkan ulang).
    expect((await agent.get('/api/admin/students')).status).toBe(200);
    expect(await prisma.auditLog.count({ where: { action: 'system.factory_reset', status: 'success' } })).toBe(1);
  });

  it('butuh kata sandi & konfirmasi yang benar, dan tidak boleh saat pemungutan suara berjalan', async () => {
    await seedElectionData();
    const { agent, token } = await loginAs('admin.uji');

    const wrong = await agent.post('/api/admin/factory-reset').set('x-csrf-token', token).send({ password: 'salah', confirm: 'RESET' });
    expect(wrong.status).toBe(400);

    const noConfirm = await agent
      .post('/api/admin/factory-reset')
      .set('x-csrf-token', token)
      .send({ password: 'kode-akses-uji', confirm: 'reset' });
    expect(noConfirm.status).toBe(400);

    await setElection({ status: 'open' });
    const running = await agent
      .post('/api/admin/factory-reset')
      .set('x-csrf-token', token)
      .send({ password: 'kode-akses-uji', confirm: 'RESET' });
    expect(running.status).toBe(409);
    expect(await prisma.vote.count()).toBe(1);
  });

  it('cadangan & reset hanya untuk panitia', async () => {
    await createUser('7200');
    const siswa = await loginAs('7200');
    expect((await siswa.agent.get('/api/admin/backup')).status).toBe(403);
    expect((await request(app).get('/api/admin/backup')).status).toBe(401);
  });
});
