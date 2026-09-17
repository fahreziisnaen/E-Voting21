import { useMutation } from '@tanstack/react-query';
import { Download, Info, LoaderCircle, Trophy } from 'lucide-react';
import { CandidateBadge } from '../../components/CandidateVisuals';
import { useToast } from '../../components/Toast';
import { AdminPageHeader, ErrorNotice, Panel } from '../../features/admin/AdminUi';
import { StatCards } from '../../features/admin/Charts';
import { useResults } from '../../hooks/admin';
import { useElection } from '../../hooks/queries';
import { downloadFile, errorMessage } from '../../lib/api';
import { candidateAccent } from '../../lib/candidates';
import { cn } from '../../lib/cn';
import { formatClock, formatNumber, formatPercent, wibDateKey } from '../../lib/format';

export default function ResultsPage() {
  const results = useResults();
  const election = useElection();
  const toast = useToast();
  const phase = election.data?.phase;
  const isFinal = phase === 'ended' || phase === 'closed';

  const exportCsv = useMutation({
    mutationFn: () => downloadFile('/admin/results/export.csv', `hasil-voting-osis-${wibDateKey(new Date())}.csv`),
    onSuccess: () => toast('File CSV hasil voting berhasil diunduh.', 'success'),
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const candidates = results.data?.perCandidate ?? [];
  const topVotes = Math.max(0, ...candidates.map((c) => c.votes));
  const leaders = candidates.filter((c) => c.votes === topVotes && topVotes > 0);

  return (
    <>
      <AdminPageHeader
        title="Hasil Voting"
        actions={
          <button type="button" onClick={() => exportCsv.mutate()} disabled={exportCsv.isPending} className="btn btn-primary h-10">
            {exportCsv.isPending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Download aria-hidden className="size-4" />}
            Export CSV
          </button>
        }
      />

      {!isFinal && phase && (
        <p className="flex items-start gap-2.5 rounded-card border border-warning-line bg-warning-bg px-4 py-3 text-[13px] leading-normal font-semibold text-warning-ink">
          <Info aria-hidden className="mt-px size-4 shrink-0" />
          Ini hasil sementara — pemungutan suara belum ditutup. Jangan publikasikan ke siswa sebelum masa pemungutan suara
          selesai.
        </p>
      )}

      {results.isError && <ErrorNotice message={errorMessage(results.error)} onRetry={() => void results.refetch()} />}
      <StatCards totals={results.data?.totals} />

      <Panel
        title="Rekapitulasi Perolehan Suara"
        titleId="rekap-judul"
        description={results.data ? `Data per ${formatClock(results.data.generatedAt)} WIB · diurutkan berdasarkan nomor urut` : undefined}
      >
        {results.data ? (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[620px] border-collapse text-left text-sm">
              <caption className="sr-only">Rekapitulasi perolehan suara per kandidat</caption>
              <thead>
                <tr className="border-b border-line-soft text-[11px] tracking-[0.06em] text-ink-muted uppercase">
                  <th scope="col" className="w-16 pb-2.5 font-extrabold">No.</th>
                  <th scope="col" className="pb-2.5 font-extrabold">Kandidat</th>
                  <th scope="col" className="w-28 pb-2.5 text-right font-extrabold">Suara</th>
                  <th scope="col" className="w-24 pb-2.5 text-right font-extrabold">Persentase</th>
                  <th scope="col" className="w-[28%] pb-2.5 pl-5 font-extrabold">
                    <span className="sr-only">Proporsi</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate) => (
                  <tr key={candidate.id} className="border-b border-canvas last:border-0">
                    <td className="py-3.5">
                      <CandidateBadge number={candidate.candidateNumber} size="sm" className="shadow-none" />
                    </td>
                    <td className="py-3.5">
                      <p className="flex flex-wrap items-center gap-2 font-bold">
                        {candidate.name}
                        {isFinal && leaders.length === 1 && leaders[0]!.id === candidate.id && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-extrabold text-gold-ink">
                            <Trophy aria-hidden className="size-3" /> Perolehan tertinggi
                          </span>
                        )}
                      </p>
                      <p className="text-[13px] text-ink-muted">{candidate.className}</p>
                    </td>
                    <td className="py-3.5 text-right font-extrabold tabular-nums">{formatNumber(candidate.votes)}</td>
                    <td className="py-3.5 text-right tabular-nums text-ink-body">{formatPercent(candidate.percentage)}</td>
                    <td className="py-3.5 pl-5">
                      <div aria-hidden className="h-3 overflow-hidden rounded-[4px] bg-line-soft">
                        <div
                          className={cn('h-full rounded-r-[4px]', candidateAccent(candidate.candidateNumber).bar)}
                          style={{ width: `${candidate.percentage}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line text-[13px]">
                  <th scope="row" colSpan={2} className="pt-3 font-bold">
                    Total suara masuk
                  </th>
                  <td className="pt-3 text-right font-extrabold tabular-nums">{formatNumber(results.data.totals.totalVotes)}</td>
                  <td className="pt-3 text-right tabular-nums text-ink-body">{results.data.totals.totalVotes ? '100%' : '0%'}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div aria-hidden className="h-56 animate-pulse rounded-card bg-line-soft" />
        )}
        {isFinal && leaders.length > 1 && (
          <p className="mt-4 text-[13px] font-semibold text-warning-ink">
            Terdapat perolehan suara tertinggi yang sama. Tindak lanjuti sesuai tata tertib pemilihan.
          </p>
        )}
      </Panel>
    </>
  );
}
