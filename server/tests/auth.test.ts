import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { app, createUser, loginAs, resetDatabase, setElection } from './helpers.js';

beforeEach(async () => {
  await resetDatabase();
  await setElection();
});

afterAll(() => prisma.$disconnect());

const cookieHeader = (res: request.Response) => ([] as string[]).concat(res.headers['set-cookie'] ?? []);

describe('POST /api/auth/login', () => {
  it('menolak request tanpa token CSRF', async () => {
    await createUser('1001');
    const res = await request(app).post('/api/auth/login').send({ nis: '1001', password: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF_INVALID');
  });

  it('login berhasil memasang cookie httpOnly + SameSite=Strict', async () => {
    await createUser('1001');
    const { login } = await loginAs('1001');
    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({ nis: '1001', role: 'student' });
    expect(login.body.user.passwordHash).toBeUndefined();

    const cookies = cookieHeader(login);
    const access = cookies.find((c) => c.startsWith('ev_access='));
    expect(access).toMatch(/HttpOnly/);
    expect(access).toMatch(/SameSite=Strict/);

    const logs = await prisma.auditLog.findMany({ where: { action: 'auth.login', status: 'success' } });
    expect(logs).toHaveLength(1);
  });

  it('kode akses salah → 401 dengan pesan Indonesia dan tercatat di audit log', async () => {
    await createUser('1001');
    const { login } = await loginAs('1001', 'salah-total');
    expect(login.status).toBe(401);
    expect(login.body.message).toMatch(/salah/);

    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'auth.login' } });
    expect(log).toMatchObject({ status: 'failed', actor: '1001' });
  });

  it('NIS yang tidak terdaftar mendapat pesan yang sama (tidak membocorkan akun)', async () => {
    await createUser('1001');
    const unknown = await loginAs('9999');
    const wrong = await loginAs('1001', 'salah-total');
    expect(unknown.login.body.message).toBe(wrong.login.body.message);
  });
});

describe('sesi', () => {
  it('GET /api/auth/me mengembalikan status voting dari server', async () => {
    await createUser('1001');
    const { agent } = await loginAs('1001');
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ votes: [], user: { nis: '1001' } });
  });

  it('pengunjung tanpa cookie sesi → 200 dengan user null (beranda publik)', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null, votes: [] });
  });

  it('cookie sesi tidak valid → tetap 401 agar klien mencoba refresh', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'ev_access=token-palsu');
    expect(res.status).toBe(401);
  });

  it('logout mencabut token: cookie lama tidak bisa dipakai lagi', async () => {
    await createUser('1001');
    const { agent, token, login } = await loginAs('1001');
    const oldCookies = cookieHeader(login).map((c) => c.split(';')[0]).join('; ');

    const logout = await agent.post('/api/auth/logout').set('x-csrf-token', token);
    expect(logout.status).toBe(204);

    const replay = await request(app).get('/api/auth/me').set('Cookie', oldCookies);
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe('SESSION_REVOKED');
  });

  it('refresh token menerbitkan access token baru', async () => {
    await createUser('1001');
    const { agent, token } = await loginAs('1001');
    const refreshed = await agent.post('/api/auth/refresh').set('x-csrf-token', token);
    expect(refreshed.status).toBe(200);
    expect(cookieHeader(refreshed).some((c) => c.startsWith('ev_access='))).toBe(true);
  });
});
