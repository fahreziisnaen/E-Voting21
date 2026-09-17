import argon2 from 'argon2';

// Parameter argon2id minimum yang direkomendasikan OWASP (m=19 MiB, t=2, p=1).
const HASH_OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, HASH_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/** Menyamakan waktu respons saat NIS tidak ditemukan agar akun tidak bisa ditebak. */
export async function verifyAgainstDummy(plain: string): Promise<false> {
  dummyHash ??= hashPassword('dummy-password-for-constant-timing');
  await verifyPassword(await dummyHash, plain);
  return false;
}
