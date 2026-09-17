import { describe, expect, it } from 'vitest';
import { parseCsv, parseStudentRows } from './csv';
import { detectGradeLevel } from './grade';
import { formatDateRange, formatDateTime, formatPercent, formatTimeRange, joinWib, splitWib } from './format';

describe('format (selalu WIB)', () => {
  const start = '2025-09-12T00:00:00.000Z'; // 07:00 WIB
  const end = '2025-09-14T08:00:00.000Z'; // 15:00 WIB

  it('rentang tanggal & jam sesuai desain', () => {
    expect(formatDateRange(start, end)).toBe('12 – 14 September 2025');
    expect(formatTimeRange(start, end)).toBe('07:00 – 15:00 WIB');
  });

  it('rentang lintas bulan', () => {
    expect(formatDateRange('2025-09-30T01:00:00Z', '2025-10-02T08:00:00Z')).toBe('30 September – 2 Oktober 2025');
  });

  it('waktu voting dan persentase berformat Indonesia', () => {
    expect(formatDateTime('2025-09-14T03:42:00Z')).toBe('14/09/2025 · 10:42 WIB');
    expect(formatPercent(73.1)).toBe('73,1%');
  });

  it('konversi form tanggal/jam WIB bolak-balik', () => {
    const iso = joinWib('2025-09-12', '07:00');
    expect(new Date(iso).toISOString()).toBe(start);
    expect(splitWib(start)).toEqual({ date: '2025-09-12', time: '07:00' });
  });
});

describe('CSV impor siswa', () => {
  it('mendukung pemisah titik koma, kutip, dan BOM', () => {
    expect(parseCsv('﻿a;b\r\n"x;y";"kata ""kutip"""\r\n')).toEqual([
      ['a', 'b'],
      ['x;y', 'kata "kutip"'],
    ]);
  });

  it('memvalidasi baris, melaporkan nomor baris, dan membuat kode akses yang kosong', () => {
    const table = parseCsv(
      [
        'NIS;Nama;Kelas;Kode_Akses',
        '0021501;Budi  Santoso;XII  IPA 1;rahasia1',
        '12;Ani;X-2;rahasia2',
        '0021503;Citra;X-3;123',
        '0021504;Dewi;XI IPS 2;',
        '0021501;Budi Lagi;X-1;',
      ].join('\n'),
    );
    const { rows, errors } = parseStudentRows(table);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ nis: '0021501', name: 'Budi Santoso', className: 'XII IPA 1', password: 'rahasia1', generatedCode: false });
    expect(rows[1]).toMatchObject({ nis: '0021504', className: 'XI IPS 2', generatedCode: true });
    expect(rows[1]!.password).toMatch(/^[a-z2-9]{8}$/);
    expect(errors).toEqual([
      'Baris 3: NIS "12" tidak valid.',
      'Baris 4: kode akses minimal 6 karakter (atau kosongkan).',
      'Baris 6: NIS 0021501 muncul lebih dari sekali.',
    ]);
  });

  it('menerima sel dari Excel (angka, null) dan kolom kode akses opsional', () => {
    const { rows, errors } = parseStudentRows([
      ['NIS', 'Nama Siswa', 'Rombel'],
      [null, null, null],
      [21453, 'Ahmad', 'XII IPA 2'],
    ]);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ nis: '21453', name: 'Ahmad', className: 'XII IPA 2', generatedCode: true });
  });

  it('menolak berkas tanpa kolom wajib', () => {
    expect(parseStudentRows(parseCsv('nis,nama\n1,a')).errors[0]).toMatch(/kelas/);
  });

  it('mengenali tingkat kelas dari nama', () => {
    expect(detectGradeLevel('XII IPA 1')).toBe(12);
    expect(detectGradeLevel('XI-2')).toBe(11);
    expect(detectGradeLevel('X 3')).toBe(10);
    expect(detectGradeLevel('XIPA')).toBeNull();
  });
});
