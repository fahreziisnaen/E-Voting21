import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { AdminPageHeader, ErrorNotice, Panel } from '../../features/admin/AdminUi';
import { AuditLogTable } from '../../features/admin/AuditLogTable';
import { HourlyParticipationChart, StatCards, visibleHours, VotesByCandidate } from '../../features/admin/Charts';
import { useAuditLogs, useStats } from '../../hooks/admin';
import { useElection } from '../../hooks/queries';
import { errorMessage } from '../../lib/api';
import { currentWibHour, formatLongDate, wibDateKey } from '../../lib/format';

export default function OverviewPage() {
  const stats = useStats();
  const election = useElection();
  const audit = useAuditLogs({ page: 1, pageSize: 6 }, 15_000);
  const isToday = stats.data?.date === wibDateKey(new Date());
  const currentHour = isToday ? currentWibHour() : null;

  return (
    <>
      <AdminPageHeader title="Dashboard Overview" />

      {stats.isError && <ErrorNotice message={errorMessage(stats.error)} onRetry={() => void stats.refetch()} />}
      <StatCards totals={stats.data?.totals} />

      <div className="grid items-start gap-[18px] xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Panel
          title="Perolehan Suara per Kandidat"
          titleId="overview-perolehan"
          description="Angka bersifat internal panitia dan belum dipublikasikan ke siswa."
        >
          {stats.data ? (
            <VotesByCandidate candidates={stats.data.perCandidate} totalVotes={stats.data.totals.totalVotes} />
          ) : (
            <div aria-hidden className="h-40 animate-pulse rounded-card bg-line-soft" />
          )}
        </Panel>
        <Panel
          title="Partisipasi per Jam"
          titleId="overview-per-jam"
          description={stats.data ? `Hari ini, ${formatLongDate(new Date())}` : ' '}
        >
          {stats.data ? (
            <HourlyParticipationChart
              buckets={visibleHours(stats.data.perHour, election.data, currentHour)}
              currentHour={currentHour}
              height={168}
            />
          ) : (
            <div aria-hidden className="h-44 animate-pulse rounded-card bg-line-soft" />
          )}
        </Panel>
      </div>

      <Panel
        title="Audit Log Terbaru"
        titleId="overview-audit"
        actions={
          <Link to="/admin/audit-log" className="inline-flex items-center gap-1 text-[13px] font-bold text-royal hover:text-navy-hover">
            Lihat semua <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        }
      >
        {audit.isError ? (
          <ErrorNotice message={errorMessage(audit.error)} onRetry={() => void audit.refetch()} />
        ) : audit.data ? (
          <AuditLogTable logs={audit.data.logs} caption="Aktivitas terbaru" />
        ) : (
          <div aria-hidden className="h-40 animate-pulse rounded-card bg-line-soft" />
        )}
      </Panel>
    </>
  );
}
