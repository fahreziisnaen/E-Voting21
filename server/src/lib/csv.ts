type Cell = string | number | null | undefined;

/**
 * Meng-escape satu sel CSV. Sel yang diawali = + - @ (atau tab/CR) diberi awalan `'`
 * agar tidak dieksekusi sebagai formula saat dibuka di Excel (CSV injection).
 */
export function escapeCsvCell(value: Cell): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Cell[][]): string {
  // BOM agar Excel membaca UTF-8 dengan benar.
  return '﻿' + rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n') + '\r\n';
}
