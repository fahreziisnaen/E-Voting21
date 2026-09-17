import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { detectGradeLevel } from '../src/lib/grade.js';
import { prisma } from '../src/lib/prisma.js';
import { app, createCandidates, createClass, createUser, loginAs, resetDatabase, setElection } from './helpers.js';

const candidateBody = (candidateNumber: number, studentId: number) => ({
  candidateNumber,
  studentId,
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

    const student = await createUser('4001', 'student', 'Siswa Satu', 'XI IPA 2');
    await prisma.user.update({ where: { id: student.id }, data: { hasVoted: true } });
    const list = await agent.get('/api/admin/classes');
    expect(list.body.classes).toEqual([expect.objectContaining({ name: 'XI IPA 2', studentCount: 1, votedCount: 1 })]);

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
    expect(students.body.students[0]).toMatchObject({ className: 'XI MIPA 2', gradeLevel: 11 });

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
    expect(grade10.body.students.map((s: { nis: string }) => s.nis)).toEqual(['5001']);

    const classId = (await prisma.schoolClass.findUniqueOrThrow({ where: { name: 'XII IPA 1' } })).id;
    const byClass = await agent.get(`/api/admin/students?classId=${classId}`);
    expect(byClass.body.students.map((s: { nis: string }) => s.nis)).toEqual(['5002']);
  });
});

describe('kandidat dipilih dari siswa', () => {
  it('nama & kelas kandidat berasal dari data siswa', async () => {
    const student = await createUser('6001', 'student', 'Budi Kandidat', 'XII IPS 1');
    const { agent, token } = await loginAs('admin.uji');

    const created = await agent.post('/api/admin/candidates').set('x-csrf-token', token).send(candidateBody(1, student.id));
    expect(created.status).toBe(201);
    expect(created.body.candidate).toMatchObject({ name: 'Budi Kandidat', className: 'XII IPS 1', nis: '6001', studentId: student.id });

    await prisma.user.update({ where: { id: student.id }, data: { name: 'Budi Santoso' } });
    const voter = await createUser('6002');
    const voterSession = await loginAs(voter.nis);
    const publicList = await voterSession.agent.get('/api/candidates');
    expect(publicList.body.candidates[0]).toMatchObject({ name: 'Budi Santoso', className: 'XII IPS 1' });
    // NIS kandidat tidak ditampilkan ke siswa lain.
    expect(publicList.body.candidates[0].nis).toBeUndefined();

    const listed = await agent.get('/api/admin/students?q=6001');
    expect(listed.body.students[0].candidateNumber).toBe(1);
  });

  it('satu siswa hanya bisa menjadi satu kandidat; nomor urut unik; harus siswa', async () => {
    const [first] = await createCandidates();
    const other = await createUser('7001');
    const admin = await prisma.user.findUniqueOrThrow({ where: { nis: 'admin.uji' } });
    const { agent, token } = await loginAs('admin.uji');
    const post = (body: object) => agent.post('/api/admin/candidates').set('x-csrf-token', token).send(body);

    const sameStudent = await post(candidateBody(5, first!.userId));
    expect(sameStudent.status).toBe(409);
    expect(sameStudent.body.code).toBe('STUDENT_ALREADY_CANDIDATE');
    expect(sameStudent.body.message).toMatch(/kandidat No\. 1/);

    const sameNumber = await post(candidateBody(1, other.id));
    expect(sameNumber.status).toBe(409);
    expect(sameNumber.body.code).toBe('DUPLICATE_CANDIDATE_NUMBER');

    const notStudent = await post(candidateBody(6, admin.id));
    expect(notStudent.status).toBe(400);
    expect(notStudent.body.details[0].path).toBe('studentId');

    // Mengedit kandidat tanpa mengganti siswanya tetap boleh.
    const edit = await agent
      .put(`/api/admin/candidates/${first!.id}`)
      .set('x-csrf-token', token)
      .send({ ...candidateBody(1, first!.userId), vision: 'Visi yang diperbarui.' });
    expect(edit.status).toBe(200);
  });

  it('siswa yang menjadi kandidat tidak bisa dihapus; menghapus kandidat tidak menghapus siswanya', async () => {
    const [first] = await createCandidates();
    const { agent, token } = await loginAs('admin.uji');

    const deleteStudent = await agent.delete(`/api/admin/students/${first!.userId}`).set('x-csrf-token', token);
    expect(deleteStudent.status).toBe(409);
    expect(deleteStudent.body.code).toBe('STUDENT_IS_CANDIDATE');

    expect((await agent.delete(`/api/admin/candidates/${first!.id}`).set('x-csrf-token', token)).status).toBe(204);
    expect(await prisma.user.findUnique({ where: { id: first!.userId } })).not.toBeNull();
  });

  it('mengganti siswa kandidat saat pemungutan suara berlangsung ditolak', async () => {
    const [first] = await createCandidates();
    const other = await createUser('8001');
    await setElection({ status: 'open' });
    const { agent, token } = await loginAs('admin.uji');
    const res = await agent.put(`/api/admin/candidates/${first!.id}`).set('x-csrf-token', token).send(candidateBody(1, other.id));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ELECTION_IN_PROGRESS');
  });
});

describe('impor siswa & kelas', () => {
  it('kelas yang belum terdaftar ditolak kecuali createMissingClasses', async () => {
    const { agent, token } = await loginAs('admin.uji');
    const students = [
      { nis: '9101', name: 'Siswa A', className: 'XI IPS 4', password: 'kode-a-123' },
      { nis: '9102', name: 'Siswa B', className: 'Kelas Khusus', password: 'kode-b-123' },
    ];

    const rejected = await agent.post('/api/admin/students/import').set('x-csrf-token', token).send({ students });
    expect(rejected.status).toBe(400);
    expect(rejected.body.code).toBe('UNKNOWN_CLASSES');
    expect(await prisma.user.count({ where: { role: 'student' } })).toBe(0);

    const accepted = await agent
      .post('/api/admin/students/import')
      .set('x-csrf-token', token)
      .send({ students, createMissingClasses: true });
    expect(accepted.status).toBe(201);
    expect(accepted.body).toMatchObject({ created: 2, createdNis: ['9101', '9102'] });
    expect(await prisma.schoolClass.findUnique({ where: { name: 'XI IPS 4' } })).toMatchObject({ gradeLevel: 11 });
    expect(await prisma.schoolClass.findUnique({ where: { name: 'Kelas Khusus' } })).toMatchObject({ gradeLevel: null });

    // Siswa hasil impor bisa login dengan kode aksesnya.
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
