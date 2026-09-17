import { RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AdminPageHeader, ErrorNotice, Panel, selectClass } from '../../features/admin/AdminUi';
import { HourlyParticipationChart, StatCards, visibleHours, VotesByCandidate } from '../../features/admin/Charts';
import { useStats } from '../../hooks/admin';
import { useElection } from '../../hooks/queries';
import { errorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';
import { currentWibHour, formatClock, formatLongDate, wibDateKey } from '../../lib/format';

/** Daftar tanggal (WIB) dalam masa pemilihan, maksimal 31 hari. */
function electionDays(startIso: string, endIso: string): string[] {
  const days: string[] = [];
  const last = wibDateKey(endIso);
  let cursor = new Date(`${wibDateKey(startIso)}T12:00:00+07:00`);
  while (days.length < 31) {
    const key = wibDateKey(cursor);
    days.push(key);
    if (key >= last) break;
    cursor = new Date(cursor.getTime() + 86_400_000);
  }
  return days;
}

export default function MonitoringPage() {
  const election = useElection();
  const today = wibDateKey(new Date());
  const days = useMemo(
    () => (election.data ? electionDays(election.data.startDate, election.data.endDate) : [today]),
    [election.data, today],
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const date = selectedDate ?? (days.includes(today) ? today : days.filter((d) => d <= today).at(-1) ?? days[0]!);

  const stats = useStats(date);
  const isToday = date === today;
  const currentHour = isToday ? currentWibHour() : null;

  return (
    <>
      <AdminPageHeader title="Monitoring Voting" />

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="tanggal-monitoring" className="text-[13px] font-bold">
          Tanggal
        </label>
        <select
          id="tanggal-monitoring"
          value={date}
          onChange={(e) => setSelectedDate(e.target.value)}
          className={selectClass}
        >
          {days.map((day) => (
            <option key={day} value={day}>
              {formatLongDate(`${day}T12:00:00+07:00`)}
              {day === today ? ' (hari ini)' : ''}
            </option>
          ))}
        </select>
        <p className="text-[13px] text-ink-muted" aria-live="polite">
          Diperbarui otomatis setiap 15 detik
          {stats.data && ` · terakhir ${formatClock(stats.data.generatedAt)} WIB`}
        </p>
        <button
          type="button"
          onClick={() => void stats.refetch()}
          disabled={stats.isFetching}
          className="btn btn-outline ml-auto h-10"
        >
          <RefreshCw aria-hidden className={cn('size-4', stats.isFetching && 'animate-spin')} /> Muat ulang
        </button>
      </div>

      {stats.isError && <ErrorNotice message={errorMessage(stats.error)} onRetry={() => void stats.refetch()} />}

      <div className={cn('flex flex-col gap-[22px] transition-opacity', stats.isPlaceholderData && 'opacity-60')}>
        <StatCards totals={stats.data?.totals} />
        <div className="grid items-start gap-[18px] xl:grid-cols-2">
          <Panel
            title="Perolehan Suara per Kandidat"
            titleId="monitoring-perolehan"
            description="Akumulasi seluruh masa pemungutan suara. Bersifat internal — jangan dipublikasikan sebelum ditutup."
          >
            {stats.data ? (
              <VotesByCandidate candidates={stats.data.perCandidate} totalVotes={stats.data.totals.totalVotes} />
            ) : (
              <div aria-hidden className="h-48 animate-pulse rounded-card bg-line-soft" />
            )}
          </Panel>
          <Panel
            title="Partisipasi per Jam"
            titleId="monitoring-per-jam"
            description={`Jumlah suara masuk per jam, ${formatLongDate(`${date}T12:00:00+07:00`)} (WIB).`}
          >
            {stats.data ? (
              <HourlyParticipationChart
                buckets={visibleHours(stats.data.perHour, election.data, currentHour)}
                currentHour={currentHour}
                height={240}
              />
            ) : (
              <div aria-hidden className="h-60 animate-pulse rounded-card bg-line-soft" />
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
