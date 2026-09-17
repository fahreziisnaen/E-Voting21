import { config } from 'dotenv';

/** TEST_DATABASE_URL wajib ada dan harus berbeda dari database utama — isinya dihapus setiap test. */
export function resolveTestDatabaseUrl(): string {
  config({ quiet: true });
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error('TEST_DATABASE_URL belum diisi di server/.env (lihat .env.example).');
  }
  if (testUrl === process.env.DATABASE_URL || !/test/i.test(new URL(testUrl).pathname)) {
    throw new Error('TEST_DATABASE_URL harus database terpisah yang namanya mengandung "test".');
  }
  return testUrl;
}
