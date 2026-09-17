import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { env } from '../env.js';

function poolConfigFromUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    connectionLimit: Number(url.searchParams.get('connection_limit') ?? 10),
    // MySQL 8 (caching_sha2_password) tanpa TLS butuh ini. Gunakan jaringan privat / localhost.
    allowPublicKeyRetrieval: url.searchParams.get('allowPublicKeyRetrieval') !== 'false',
  };
}

export const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(poolConfigFromUrl(env.DATABASE_URL)),
});

export type DbClient = PrismaClient | Prisma.TransactionClient;

export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}
