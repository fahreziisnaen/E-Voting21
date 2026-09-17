import { ChartColumn, Table } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CandidateBadge } from '../../components/CandidateVisuals';
import { candidateAccent } from '../../lib/candidates';
import { cn } from '../../lib/cn';
import { formatNumber, formatPercent } from '../../lib/format';
import type { CandidateResult, ResultTotals } from '../../types';

export function StatCards({ totals }: { totals: ResultTotals | undefined }) {
  const value = (n: number | undefined) => (n === undefined ? '—' : formatNumber(n));
  const cards = [
    { label: 'Total Siswa Terdaftar', value: value(totals?.students), accent: '', ink: '' },
    { label: 'Sudah Voting', value: value(totals?.voted), accent: 'border-t-[3px] border-t-success', ink: 'text-success-ink' },
    { label: 'Belum Voting', value: value(totals?.notVoted), accent: 'border-t-[3px] border-t-warning', ink: 'text-warning-ink' },
  ];
  return (
    <section aria-label="Ringkasan partisipasi" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className={cn('rounded-card border border-line bg-white p-[18px]', card.accent)}>
          <p className="text-xs font-bold tracking-[0.06em] text-ink-muted uppercase">{card.label}</p>
          <p className={cn('mt-2.5 text-[26px] leading-tight font-extrabold tracking-[-0.02em] sm:text-[32px]', card.ink)}>{card.value}</p>
        </div>
      ))}
      <div className="rounded-card border border-line border-t-[3px] border-t-royal bg-white p-[18px]">
        <p className="text-xs font-bold tracking-[0.06em] text-ink-muted uppercase">Partisipasi</p>
        <p className="mt-2.5 text-[26px] leading-tight font-extrabold tracking-[-0.02em] text-royal sm:text-[32px]">
          {totals ? formatPercent(totals.turnout) : '—'}
        </p>
        <div
          role="meter"
          aria-label="Partisipasi pemilih"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={totals?.turnout ?? 0}
          className="mt-3 h-2 overflow-hidden rounded-full bg-royal-soft"
        >
          <div className="h-full rounded-full bg-royal transition-[width] duration-500" style={{ width: `${totals?.turnout ?? 0}%` }} />
        </div>
      </div>
    </section>
  );
}

/**
 * Batang horizontal per kandidat. Warna mengikuti identitas kandidat (bukan peringkat) dan
 * selalu didampingi nomor + nama + nilai tertulis, sehingga identitas tidak bergantung pada warna.
 */
export function VotesByCandidate({ candidates, totalVotes }: { candidates: CandidateResult[]; totalVotes: number }) {
  if (candidates.length === 0) {
    return <p className="text-sm text-ink-muted">Belum ada kandidat.</p>;
  }
  return (
    <ul className="flex flex-col gap-4">
      {candidates.map((candidate) => (
        <li key={candidate.id}>
          <div className="mb-[7px] flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px] font-bold">
            <span className="flex min-w-0 items-center gap-2">
              <CandidateBadge number={candidate.candidateNumber} size="sm" className="size-6 text-xs shadow-none" />
              <span className="truncate">{candidate.name}</span>
            </span>
            <span className="text-ink-muted tabular-nums">
              {formatNumber(candidate.votes)} suara · {formatPercent(candidate.percentage)}
            </span>
          </div>
          <div aria-hidden className="h-3 overflow-hidden rounded-[4px] bg-line-soft">
            <div
              className={cn('h-full rounded-r-[4px] transition-[width] duration-500', candidateAccent(candidate.candidateNumber).bar)}
              style={{ width: totalVotes && candidate.votes ? `max(${candidate.percentage}%, 4px)` : '0%' }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

interface HourBucket {
  hour: number;
  count: number;
}

const pad = (hour: number) => String(hour).padStart(2, '0');

function HourTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: HourBucket & { inProgress: boolean } }> }) {
  const item = payload?.[0]?.payload;
  if (!active || !item) return null;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-float">
      <p className="text-sm font-extrabold text-ink tabular-nums">{formatNumber(item.count)} suara</p>
      <p className="text-ink-muted">
        Pukul {pad(item.hour)}.00–{pad(item.hour)}.59 WIB{item.inProgress ? ' · masih berjalan' : ''}
      </p>
    </div>
  );
}

/** Partisipasi per jam (satu seri). Jam yang sedang berjalan diredam karena datanya belum lengkap. */
export function HourlyParticipationChart({
  buckets,
  currentHour,
  height = 200,
}: {
  buckets: HourBucket[];
  /** Jam WIB saat ini bila tanggal yang ditampilkan adalah hari ini. */
  currentHour: number | null;
  height?: number;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const data = buckets.map((b) => ({ ...b, label: pad(b.hour), inProgress: b.hour === currentHour }));
  const hasInProgress = data.some((d) => d.inProgress);

  return (
    <div>
      <div className="mb-3 flex items-center gap-3 text-xs text-ink-muted">
        {hasInProgress && (
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[3px] bg-ink-subtle" /> Jam berjalan (belum lengkap)
          </span>
        )}
        <div className="ml-auto inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="Tampilan data">
          {(['chart', 'table'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={view === mode}
              onClick={() => setView(mode)}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 font-semibold',
                view === mode ? 'bg-line-soft text-ink' : 'text-ink-muted hover:text-ink',
              )}
            >
              {mode === 'chart' ? <ChartColumn aria-hidden className="size-3.5" /> : <Table aria-hidden className="size-3.5" />}
              {mode === 'chart' ? 'Grafik' : 'Tabel'}
            </button>
          ))}
        </div>
      </div>

      {view === 'chart' ? (
        <div style={{ height }} role="img" aria-label="Grafik batang jumlah suara per jam. Gunakan tampilan Tabel untuk membaca angka.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
              <CartesianGrid vertical={false} stroke="#EEF3F9" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: '#E4ECF6' }}
                tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }}
                interval={data.length > 14 ? 'preserveStartEnd' : 0}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={40}
                tick={{ fontSize: 11, fill: '#64748B' }}
              />
              <Tooltip cursor={{ fill: 'rgba(11,92,171,0.06)' }} content={<HourTooltip />} isAnimationActive={false} />
              <Bar dataKey="count" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {data.map((d) => (
                  <Cell key={d.hour} fill={d.inProgress ? '#94A3B8' : '#0B5CAB'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="max-h-[260px] overflow-y-auto" style={{ minHeight: height }}>
          <table className="w-full text-left text-[13px]">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-line-soft text-[11px] tracking-[0.06em] text-ink-muted uppercase">
                <th className="py-2 font-extrabold">Jam (WIB)</th>
                <th className="py-2 text-right font-extrabold">Suara</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.hour} className="border-b border-canvas">
                  <td className="py-1.5 tabular-nums">
                    {pad(d.hour)}.00–{pad(d.hour)}.59{d.inProgress ? ' (berjalan)' : ''}
                  </td>
                  <td className="py-1.5 text-right font-bold tabular-nums">{formatNumber(d.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Rentang jam yang ditampilkan: jam buka–tutup harian dari jadwal; bila jadwal dibuka
 * sepanjang hari, dipersempit ke jam yang memiliki aktivitas (minimal 8 jam).
 */
export function visibleHours(
  perHour: HourBucket[],
  schedule: { startDate: string; endDate: string } | undefined,
  currentHour: number | null,
): HourBucket[] {
  const minutesOf = (iso: string) => {
    const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .format(new Date(iso))
      .split(':')
      .map(Number);
    return h! * 60 + m!;
  };
  let from = 0;
  let to = 23;
  if (schedule) {
    const open = minutesOf(schedule.startDate);
    const close = minutesOf(schedule.endDate);
    if (open < close) {
      from = Math.floor(open / 60);
      to = Math.ceil(close / 60) - 1; // tutup 15:00 → jam terakhir 14.00–14.59
    }
  }
  // Rentang lebih dari 12 jam dipersempit ke jam yang aktif (±1 jam), minimal 8 batang.
  if (to - from > 12) {
    const active = perHour.filter((b) => b.count > 0).map((b) => b.hour);
    if (currentHour !== null) active.push(currentHour);
    if (active.length) {
      const lo = Math.max(from, Math.min(...active) - 1);
      const hi = Math.min(to, Math.max(Math.max(...active) + 1, lo + 7));
      from = lo;
      to = hi;
    } else {
      from = Math.max(from, 6);
      to = Math.min(to, 17);
    }
  }
  return perHour.filter((b) => b.hour >= from && b.hour <= to);
}
