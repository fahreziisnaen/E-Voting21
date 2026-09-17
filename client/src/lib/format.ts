/** Semua waktu ditampilkan dalam WIB, apa pun zona waktu perangkat siswa. */
const TIME_ZONE = 'Asia/Jakarta';

const partsFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function wibParts(value: string | Date) {
  const parts = Object.fromEntries(
    partsFormatter.formatToParts(new Date(value)).map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  const monthIndex = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, month: 'numeric' }).format(new Date(value)),
  );
  return {
    day: Number(parts.day),
    month: parts.month!,
    monthNumber: String(monthIndex).padStart(2, '0'),
    year: Number(parts.year),
    hour: parts.hour!.padStart(2, '0'),
    minute: parts.minute!.padStart(2, '0'),
    second: parts.second!.padStart(2, '0'),
  };
}

export function formatNumber(value: number): string {
  return value.toLocaleString('id-ID');
}

export function formatPercent(value: number): string {
  return `${value.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;
}

/** "12 – 14 September 2025" atau "30 September – 2 Oktober 2025". */
export function formatDateRange(startIso: string, endIso: string): string {
  const start = wibParts(startIso);
  const end = wibParts(endIso);
  if (start.year !== end.year) {
    return `${start.day} ${start.month} ${start.year} – ${end.day} ${end.month} ${end.year}`;
  }
  if (start.month !== end.month) return `${start.day} ${start.month} – ${end.day} ${end.month} ${end.year}`;
  if (start.day !== end.day) return `${start.day} – ${end.day} ${end.month} ${end.year}`;
  return `${start.day} ${start.month} ${start.year}`;
}

/** "07:00 – 15:00 WIB" */
export function formatTimeRange(startIso: string, endIso: string): string {
  const start = wibParts(startIso);
  const end = wibParts(endIso);
  return `${start.hour}:${start.minute} – ${end.hour}:${end.minute} WIB`;
}

/** "14/09/2025 · 10:42 WIB" */
export function formatDateTime(iso: string): string {
  const p = wibParts(iso);
  return `${String(p.day).padStart(2, '0')}/${p.monthNumber}/${p.year} · ${p.hour}:${p.minute} WIB`;
}

/** "14 September 2025" */
export function formatLongDate(value: string | Date): string {
  const p = wibParts(value);
  return `${p.day} ${p.month} ${p.year}`;
}

/** "10:42:08" */
export function formatClock(iso: string): string {
  const p = wibParts(iso);
  return `${p.hour}:${p.minute}:${p.second}`;
}

export function currentWibHour(): number {
  return Number(wibParts(new Date()).hour);
}

export function wibYear(iso: string): number {
  return wibParts(iso).year;
}

/** Kunci tanggal WIB "YYYY-MM-DD". */
export function wibDateKey(value: string | Date): string {
  const p = wibParts(value);
  return `${p.year}-${p.monthNumber}-${String(p.day).padStart(2, '0')}`;
}

/** ISO → nilai <input type="date"> dan <input type="time"> dalam WIB. */
export function splitWib(iso: string): { date: string; time: string } {
  const p = wibParts(iso);
  return { date: wibDateKey(iso), time: `${p.hour}:${p.minute}` };
}

/** Tanggal + jam WIB dari form → ISO dengan offset +07:00. */
export function joinWib(date: string, time: string): string {
  return `${date}T${time}:00+07:00`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}
