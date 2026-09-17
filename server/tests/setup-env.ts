import { resolveTestDatabaseUrl } from './test-database-url.js';

process.env.DATABASE_URL = resolveTestDatabaseUrl();
process.env.NODE_ENV = 'test';
process.env.COOKIE_SECURE = 'false';
