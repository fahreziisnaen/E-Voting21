import { describe, expect, it } from 'vitest';
import { escapeCsvCell, toCsv } from '../src/lib/csv.js';
import { detectImageExtension } from '../src/lib/uploads.js';
import { computeElectionPhase } from '../src/services/election.js';
import { generateReceiptCode } from '../src/services/votes.js';

const wib = (value: string) => new Date(`${value}+07:00`);

describe('computeElectionPhase', () => {
  // 12–14 September, dibuka 07:00–15:00 WIB setiap hari.
  const schedule = {
    status: 'open' as const,
    startDate: wib('2025-09-12T07:00:00'),
    endDate: wib('2025-09-14T15:00:00'),
  };

  it('aktif di dalam rentang tanggal dan jam', () => {
    expect(computeElectionPhase(schedule, wib('2025-09-12T07:00:00'))).toBe('active');
    expect(computeElectionPhase(schedule, wib('2025-09-13T12:30:00'))).toBe('active');
    expect(computeElectionPhase(schedule, wib('2025-09-14T14:59:59'))).toBe('active');
  });

  it('di luar jam harian pada hari pemilihan', () => {
    expect(computeElectionPhase(schedule, wib('2025-09-12T20:00:00'))).toBe('outside_hours');
    expect(computeElectionPhase(schedule, wib('2025-09-13T06:59:00'))).toBe('outside_hours');
    expect(computeElectionPhase(schedule, wib('2025-09-13T15:00:00'))).toBe('outside_hours');
  });

  it('belum dimulai dan sudah berakhir', () => {
    expect(computeElectionPhase(schedule, wib('2025-09-12T06:59:59'))).toBe('upcoming');
    expect(computeElectionPhase(schedule, wib('2025-09-14T15:00:00'))).toBe('ended');
  });

  it('status draft/closed dari panitia selalu menang', () => {
    const now = wib('2025-09-13T10:00:00');
    expect(computeElectionPhase({ ...schedule, status: 'draft' }, now)).toBe('draft');
    expect(computeElectionPhase({ ...schedule, status: 'closed' }, now)).toBe('closed');
  });

  it('rentang lintas tengah malam dianggap kontinu', () => {
    const overnight = { status: 'open' as const, startDate: wib('2025-09-12T20:00:00'), endDate: wib('2025-09-13T06:00:00') };
    expect(computeElectionPhase(overnight, wib('2025-09-13T02:00:00'))).toBe('active');
  });
});

describe('CSV export', () => {
  it('meng-escape koma, kutip, dan baris baru', () => {
    expect(escapeCsvCell('Siti, S.Pd')).toBe('"Siti, S.Pd"');
    expect(escapeCsvCell('Kata "kutip"')).toBe('"Kata ""kutip"""');
  });

  it('menetralkan formula (CSV injection)', () => {
    expect(escapeCsvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(escapeCsvCell('+62')).toBe("'+62");
    expect(escapeCsvCell(-5)).toBe('-5');
  });

  it('menambahkan BOM UTF-8', () => {
    expect(toCsv([['a', 1]])).toBe('﻿a,1\r\n');
  });
});

describe('utilitas', () => {
  it('kode tanda terima berformat VT-TAHUN-XXXXXXXX', () => {
    expect(generateReceiptCode(wib('2025-09-13T10:00:00'))).toMatch(/^VT-2025-[A-Z2-9]{8}$/);
  });

  it('mendeteksi gambar dari magic bytes, bukan ekstensi', () => {
    expect(detectImageExtension(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg');
    expect(detectImageExtension(Buffer.from('89504e470d0a1a0a', 'hex'))).toBe('png');
    expect(detectImageExtension(Buffer.from('<svg onload=alert(1)>'))).toBeNull();
  });
});
