import { execSync } from 'node:child_process';
import { resolveTestDatabaseUrl } from './test-database-url.js';

/** Menerapkan migrasi ke database test (non-destruktif). Tiap test mengosongkan tabelnya sendiri. */
export default function setup() {
  const url = resolveTestDatabaseUrl();
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: url },
  });
}
