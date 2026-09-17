/**
 * Tingkat kelas dari awalan nama: "XII IPA 1" → 12, "XI-2" → 11, "X 3" → 10, "12 MIPA" → 12.
 * Sama dengan aturan di migrasi `kelas_kandidat_dari_siswa`.
 */
export function detectGradeLevel(className: string): 10 | 11 | 12 | null {
  const name = className.trim().toUpperCase();
  if (/^(XII|12)([^0-9A-Z]|$)/.test(name)) return 12;
  if (/^(XI|11)([^0-9A-Z]|$)/.test(name)) return 11;
  if (/^(X|10)([^0-9A-Z]|$)/.test(name)) return 10;
  return null;
}
