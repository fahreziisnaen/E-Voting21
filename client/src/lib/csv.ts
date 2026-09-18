/** Parser CSV sederhana (RFC 4180) yang mendukung pemisah `,` maupun `;` (Excel lokal Indonesia). */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

type Cell = string | number | boolean | null | undefined | unknown;

export interface VoterImportRow {
  nis: string;
  name: string;
  /** Kosong untuk guru (guru tidak terikat kelas). */
  className: string;
  password: string;
  /** true bila kode akses dibuat otomatis karena kolomnya kosong. */
  generatedCode: boolean;
}

const HEADER_ALIASES = {
  nis: ['nis', 'nisn', 'no induk', 'nomor induk'],
  /** Guru memakai username buatan panitia — NIP sengaja tidak dipakai. */
  username: ['username', 'user', 'nama pengguna', 'akun'],
  name: ['nama', 'name', 'nama siswa', 'nama_siswa', 'nama guru', 'nama lengkap'],
  className: ['kelas', 'class', 'rombel', 'rombongan belajar'],
  password: ['kode_akses', 'kode akses', 'kode', 'password'],
} as const;

export const STUDENT_CSV_TEMPLATE =
  'nis,nama,kelas,kode_akses\r\n0021501,Nama Siswa Contoh,X-1,\r\n0021502,Nama Siswa Lain,XI IPA 2,kode1234\r\n';

export const TEACHER_CSV_TEMPLATE =
  'username,nama,kode_akses\r\nguru.contoh,Nama Guru Contoh,\r\nguru.lain,Nama Guru Lain,kode1234\r\n';

const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function randomAccessCode(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

function cellText(value: Cell): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return '';
  return String(value).trim();
}

/**
 * Memvalidasi baris pemilih (dari CSV atau Excel) dengan aturan yang sama seperti server.
 * Kode akses boleh kosong — akan dibuat otomatis. Kolom kelas hanya wajib untuk siswa.
 */
export function parseVoterRows(
  table: Cell[][],
  { withClass = true }: { withClass?: boolean } = {},
): { rows: VoterImportRow[]; errors: string[] } {
  const nonEmpty = table
    .map((cells, index) => ({ cells, line: index + 1 }))
    .filter(({ cells }) => cells.some((value) => cellText(value) !== ''));
  const [header, ...body] = nonEmpty;
  if (!header) return { rows: [], errors: ['Berkas kosong.'] };

  const normalized = header.cells.map((h) => cellText(h).toLowerCase().replace(/\s+/g, ' '));
  const column = (aliases: readonly string[]) => normalized.findIndex((h) => aliases.includes(h));
  const columns = {
    nis: column(withClass ? HEADER_ALIASES.nis : HEADER_ALIASES.username),
    name: column(HEADER_ALIASES.name),
    className: column(HEADER_ALIASES.className),
    password: column(HEADER_ALIASES.password),
  };
  const idLabel = withClass ? 'NIS' : 'Username';
  const missing = (withClass ? (['nis', 'name', 'className'] as const) : (['nis', 'name'] as const))
    .filter((field) => columns[field] === -1)
    .map((field) => (field === 'nis' ? (withClass ? 'nis' : 'username') : HEADER_ALIASES[field][0]));
  if (missing.length) {
    return { rows: [], errors: [`Kolom wajib tidak ditemukan: ${missing.join(', ')}. Gunakan template.`] };
  }

  const rows: VoterImportRow[] = [];
  const errors: string[] = [];
  const seenNis = new Set<string>();
  for (const { cells, line } of body) {
    const value = (index: number) => (index === -1 ? '' : cellText(cells[index]));
    const nis = value(columns.nis);
    const name = value(columns.name).replace(/\s+/g, ' ');
    const className = value(columns.className).replace(/\s+/g, ' ');
    const code = value(columns.password);

    if (!/^[A-Za-z0-9._-]{3,32}$/.test(nis)) errors.push(`Baris ${line}: ${idLabel} "${nis}" tidak valid.`);
    else if (seenNis.has(nis.toLowerCase())) errors.push(`Baris ${line}: ${idLabel} ${nis} muncul lebih dari sekali.`);
    else if (name.length < 2 || name.length > 120) errors.push(`Baris ${line}: nama harus 2–120 karakter.`);
    else if (withClass && (!className || className.length > 40))
      errors.push(`Baris ${line}: kelas wajib diisi (maks. 40 karakter).`);
    else if (code && code.length < 6) errors.push(`Baris ${line}: kode akses minimal 6 karakter (atau kosongkan).`);
    else {
      seenNis.add(nis.toLowerCase());
      rows.push({ nis, name, className: withClass ? className : '', password: code || randomAccessCode(), generatedCode: !code });
    }
  }
  return { rows, errors };
}

/** Membaca berkas .csv atau .xlsx menjadi tabel sel. Pustaka Excel dimuat hanya saat dibutuhkan. */
export async function readSpreadsheet(file: File): Promise<Cell[][]> {
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import('read-excel-file/browser');
    return readSheet(file);
  }
  if (/\.xls$/i.test(file.name)) {
    throw new Error('Format .xls lama tidak didukung. Simpan ulang sebagai .xlsx atau .csv.');
  }
  return parseCsv(await file.text());
}

/** Escape sel CSV untuk berkas yang diunduh panitia (termasuk netralisasi formula). */
export function toCsv(rows: string[][]): string {
  const escape = (value: string) => {
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return '﻿' + rows.map((row) => row.map(escape).join(',')).join('\r\n') + '\r\n';
}

export function downloadText(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
