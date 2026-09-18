import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { detectGradeLevel } from '../src/lib/grade.js';
import { prisma } from '../src/lib/prisma.js';
import { app, createCandidates, createCategory, createClass, createUser, loginAs, resetDatabase, setElection } from './helpers.js';

const candidateBody = (categoryId: number, candidateNumber: number, userId: number) => ({
  categoryId,
  candidateNumber,
  userId,
  vision: 'Visi kandidat yang cukup panjang.',
  mission: ['Misi'],
  programs: ['Program'],
  organizationHistory: [],
});

beforeEach(async () => {
  await resetDatabase();
  // Draf: kandidat boleh ditambah/diubah.
  await setElection({ status: 'draft' });
  await createUser('admin.uji', 'admin');
});

afterAll(() => prisma.$disconnect());

describe('tingkat kelas', () => {
  it('dikenali dari awalan nama', () => {
    expect(detectGradeLevel('XII IPA 1')).toBe(12);
    expect(detectGradeLevel('xi-ips 2')).toBe(11);
    expect(detectGradeLevel('X-1')).toBe(10);
    expect(detectGradeLevel('10 MIPA 3')).toBe(10);
    expect(detectGradeLevel('XIPA')).toBeNull();
    expect(detectGradeLevel('Kelas Khusus')).toBeNull();
  });
});

describe('manajemen kelas', () => {
  it('CRUD kelas, nama unik, dan kelas berisi siswa tidak bisa dihapus', async () => {
    const { agent, token } = await loginAs('admin.uji');
    const created = await agent.post('/api/admin/classes').set('x-csrf-token', token).send({ name: '  XI   IPA 2 ', gradeLevel: 11 });
    expect(created.status).toBe(201);
    expect(created.body.class).toMatchObject({ name: 'XI IPA 2', gradeLevel: 11 });

    const duplicate = await agent.post('/api/admin/classes').set('x-csrf-token', token).send({ name: 'xi ipa 2', gradeLevel: 11 });
    expect(duplicate.status).toBe(409);

    const invalidGrade = await agent.post('/api/admin/classes').set('x-csrf-token', token).send({ name: 'IX A', gradeLevel: 9 });
    expect(invalidGrade.status).toBe(400);

    // Partisipasi kelas: siswa yang sudah memilih di minimal satu kategori.
    const [candidate] = await createCandidates('Ketua OSIS');
    await setElection({ status: 'open' });
    const student = await createUser('4001', 'student', 'Siswa Satu', 'XI IPA 2');
    const session = await loginAs(student.nis);
    expect((await session.agent.post('/api/votes').set('x-csrf-token', session.token).send({ candidateId: candidate!.id })).status).toBe(201);
    const list = await agent.get('/api/admin/classes');
    expect(list.body.classes).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'XI IPA 2', studentCount: 1, votedCount: 1 })]),
    );

    const blocked = await agent.delete(`/api/admin/classes/${created.body.class.id}`).set('x-csrf-token', token);
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('CLASS_NOT_EMPTY');

    // Ganti nama → siswa otomatis ikut.
    const renamed = await agent
      .put(`/api/admin/classes/${created.body.class.id}`)
      .set('x-csrf-token', token)
      .send({ name: 'XI MIPA 2', gradeLevel: 11 });
    expect(renamed.status).toBe(200);
    const students = await agent.get('/api/admin/students?q=4001');
    expect(students.body.voters[0]).toMatchObject({ className: 'XI MIPA 2', gradeLevel: 11, votedCount: 1 });

    const empty = await createClass('X-9', 10);
    expect((await agent.delete(`/api/admin/classes/${empty.id}`).set('x-csrf-token', token)).status).toBe(204);
    expect(await prisma.auditLog.count({ where: { action: { startsWith: 'class.' } } })).toBe(3);
  });

  it('daftar siswa bisa difilter per tingkat dan kelas', async () => {
    await createUser('5001', 'student', 'Anak Sepuluh', 'X-1');
    await createUser('5002', 'student', 'Anak Duabelas', 'XII IPA 1');
    await prisma.schoolClass.update({ where: { name: 'X-1' }, data: { gradeLevel: 10 } });
    const { agent } = await loginAs('admin.uji');

    const grade10 = await agent.get('/api/admin/students?gradeLevel=10');
    expect(grade10.body.voters.map((s: { nis: string }) => s.nis)).toEqual(['5001']);

    const classId = (await prisma.schoolClass.findUniqueOrThrow({ where: { name: 'XII IPA 1' } })).id;
    const byClass = await agent.get(`/api/admin/students?classId=${classId}`);
    expect(byClass.body.voters.map((s: { nis: string }) => s.nis)).toEqual(['5002']);
  });
});

describe('kandidat dipilih dari siswa/guru, per kategori', () => {
  it('nama & kelas kandidat berasal dari data siswa; profil publik tanpa NIS', async () => {
    const category = await createCategory('Ketua OSIS');
    const student = await createUser('6001', 'student', 'Budi Kandidat', 'XII IPS 1');
    const { agent, token } = await loginAs('admin.uji');

    const created = await agent.post('/api/admin/candidates').set('x-csrf-token', token).send(candidateBody(category.id, 1, student.id));
    expect(created.status).toBe(201);
    expect(created.body.candidate).toMatchObject({
      name: 'Budi Kandidat',
      className: 'XII IPS 1',
      nis: '6001',
      userId: student.id,
      categoryName: 'Ketua OSIS',
      role: 'student',
    });

    await prisma.user.update({ where: { id: student.id }, data: { name: 'Budi Santoso' } });
    const anonymous = await request(app).get('/api/categories');
    expect(anonymous.status).toBe(200);
    expect(anonymous.body.categories[0]).toMatchObject({ name: 'Ketua OSIS', voterScope: 'all' });
    expect(anonymous.body.categories[0].candidates[0]).toMatchObject({ name: 'Budi Santoso', className: 'XII IPS 1' });
    expect(JSON.stringify(anonymous.body)).not.toContain('6001');
    expect((await request(app).get(`/api/candidates/${created.body.candidate.id}`)).status).toBe(200);

    const listed = await agent.get('/api/admin/students?q=6001');
    expect(listed.body.voters[0].candidacies).toEqual([{ categoryId: category.id, categoryName: 'Ketua OSIS', candidateNumber: 1 }]);
  });

  it('guru bisa menjadi kandidat; satu orang boleh di kategori berbeda tapi tidak dua kali di kategori yang sama', async () => {
    const osis = await createCategory('Ketua OSIS');
    const favorit = await createCategory('Guru Favorit', 'student', 2);
    const teacher = await createUser('G900', 'teacher', 'Bu Guru');
    const student = await createUser('6100', 'student', 'Siswa Aktif');
    const admin = await prisma.user.findUniqueOrThrow({ where: { nis: 'admin.uji' } });
    const { agent, token } = await loginAs('admin.uji');
    const post = (body: object) => agent.post('/api/admin/candidates').set('x-csrf-token', token).send(body);

    const teacherCandidate = await post(candidateBody(favorit.id, 1, teacher.id));
    expect(teacherCandidate.status).toBe(201);
    expect(teacherCandidate.body.candidate).toMatchObject({ role: 'teacher', className: '', categoryName: 'Guru Favorit' });

    expect((await post(candidateBody(osis.id, 1, student.id))).status).toBe(201);
    // Nomor urut 1 dipakai lagi di kategori lain → boleh.
    expect((await post(candidateBody(favorit.id, 2, student.id))).status).toBe(201);

    const sameCategory = await post(candidateBody(osis.id, 5, student.id));
    expect(sameCategory.status).toBe(409);
    expect(sameCategory.body.code).toBe('ALREADY_CANDIDATE');
    expect(sameCategory.body.message).toMatch(/No\. 1 di kategori Ketua OSIS/);

    const sameNumber = await post(candidateBody(osis.id, 1, teacher.id));
    expect(sameNumber.status).toBe(409);
    expect(sameNumber.body.code).toBe('DUPLICATE_CANDIDATE_NUMBER');

    const notVoter = await post(candidateBody(osis.id, 6, admin.id));
    expect(notVoter.status).toBe(400);
    expect(notVoter.body.details[0].path).toBe('userId');

    const unknownCategory = await post(candidateBody(999_999, 1, student.id));
    expect(unknownCategory.status).toBe(400);
    expect(unknownCategory.body.details[0].path).toBe('categoryId');
  });

  it('siswa yang menjadi kandidat tidak bisa dihapus; menghapus kandidat tidak menghapus siswanya', async () => {
    const [first] = await createCandidates();
    const { agent, token } = await loginAs('admin.uji');

    const deleteStudent = await agent.delete(`/api/admin/students/${first!.userId}`).set('x-csrf-token', token);
    expect(deleteStudent.status).toBe(409);
    expect(deleteStudent.body.code).toBe('VOTER_IS_CANDIDATE');

    expect((await agent.delete(`/api/admin/candidates/${first!.id}`).set('x-csrf-token', token)).status).toBe(204);
    expect(await prisma.user.findUnique({ where: { id: first!.userId } })).not.toBeNull();
  });

  it('mengganti orang atau kategori kandidat saat pemungutan suara berlangsung ditolak', async () => {
    const [first] = await createCandidates();
    const other = await createUser('8001');
    await setElection({ status: 'open' });
    const { agent, token } = await loginAs('admin.uji');
    const res = await agent
      .put(`/api/admin/candidates/${first!.id}`)
      .set('x-csrf-token', token)
      .send(candidateBody(first!.categoryId, 1, other.id));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ELECTION_IN_PROGRESS');

    // Memperbaiki teks visi tetap boleh.
    const edit = await agent
      .put(`/api/admin/candidates/${first!.id}`)
      .set('x-csrf-token', token)
      .send({ ...candidateBody(first!.categoryId, 1, first!.userId), vision: 'Visi yang diperbaiki.' });
    expect(edit.status).toBe(200);
  });
});

describe('impor siswa & kelas', () => {
  it('kelas yang belum terdaftar ditolak kecuali createMissingClasses', async () => {
    const { agent, token } = await loginAs('admin.uji');
    const rows = [
      { nis: '9101', name: 'Siswa A', className: 'XI IPS 4', password: 'kode-a-123' },
      { nis: '9102', name: 'Siswa B', className: 'Kelas Khusus', password: 'kode-b-123' },
    ];

    const rejected = await agent.post('/api/admin/students/import').set('x-csrf-token', token).send({ rows });
    expect(rejected.status).toBe(400);
    expect(rejected.body.code).toBe('UNKNOWN_CLASSES');
    expect(await prisma.user.count({ where: { role: 'student' } })).toBe(0);

    const accepted = await agent.post('/api/admin/students/import').set('x-csrf-token', token).send({ rows, createMissingClasses: true });
    expect(accepted.status).toBe(201);
    expect(accepted.body).toMatchObject({ created: 2, createdNis: ['9101', '9102'] });
    expect(await prisma.schoolClass.findUnique({ where: { name: 'XI IPS 4' } })).toMatchObject({ gradeLevel: 11 });
    expect(await prisma.schoolClass.findUnique({ where: { name: 'Kelas Khusus' } })).toMatchObject({ gradeLevel: null });

    const login = await loginAs('9101', 'kode-a-123');
    expect(login.login.status).toBe(200);
    expect(login.login.body.user.className).toBe('XI IPS 4');
  });

  it('endpoint kelas hanya untuk panitia', async () => {
    const student = await createUser('9901');
    const { agent } = await loginAs(student.nis);
    expect((await agent.get('/api/admin/classes')).status).toBe(403);
    expect((await request(app).get('/api/admin/classes')).status).toBe(401);
  });
});
