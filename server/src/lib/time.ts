/** Semua jadwal ditampilkan & dihitung dalam WIB (UTC+7, tanpa DST). */
export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function shifted(date: Date): Date {
  return new Date(date.getTime() + WIB_OFFSET_MS);
}

/** "YYYY-MM-DD" menurut kalender WIB. */
export function wibDateKey(date: Date): string {
  return shifted(date).toISOString().slice(0, 10);
}

/** Menit sejak 00:00 WIB. */
export function wibMinutesOfDay(date: Date): number {
  const d = shifted(date);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function wibHour(date: Date): number {
  return shifted(date).getUTCHours();
}

export function wibYear(date: Date): number {
  return shifted(date).getUTCFullYear();
}

/** Awal hari (00:00 WIB) untuk kunci "YYYY-MM-DD". */
export function wibDayStart(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00+07:00`);
}

export function formatWib(date: Date): string {
  const d = shifted(date).toISOString();
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)} ${d.slice(11, 19)} WIB`;
}
