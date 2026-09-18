import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, ExternalLink, Info, LoaderCircle, Megaphone, Trophy, Undo2 } from 'lucide-react';
import { Link } from 'react-router';
import { CandidateBadge } from '../../components/CandidateVisuals';
import { useToast } from '../../components/Toast';
import { AdminPageHeader, ErrorNotice, Panel } from '../../features/admin/AdminUi';
import { StatCards } from '../../features/admin/Charts';
import { VoteBars } from '../../features/student/VoteResults';
import { useResults } from '../../hooks/admin';
import { useElection } from '../../hooks/queries';
import { api, downloadFile, errorMessage } from '../../lib/api';
import { candidateAccent } from '../../lib/candidates';
import { cn } from '../../lib/cn';
import { formatClock, formatDateTime, formatNumber, formatPercent, wibDateKey } from '../../lib/format';
import { personMeta, VOTER_SCOPE_LABEL } from '../../lib/voting';
import type { AdminCategoryResult } from '../../types';

function CategoryTable({ category, isFinal }: { category: AdminCategoryResult; isFinal: boolean }) {
  const captionId = `rekap-${category.id}`;
  return (
    <section aria-labelledby={captionId}>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line-soft pb-2.5">
        <h3 id={captionId} className="text-[15px] font-extrabold">
          {category.name}
        </h3>
        <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] font-bold text-ink-body">
          {VOTER_SCOPE_LABEL[category.voterScope]}
        </span>
        <span className="ml-auto text-[13px] text-ink-muted tabular-nums">
          {formatNumber(category.totalVotes)} suara · partisipasi {formatPercent(category.turnout)} dari {formatNumber(category.eligible)}{' '}
          pemilih
        </span>
      </div>
      {/* Di ponsel angka lebih mudah dibaca sebagai daftar batang daripada tabel yang harus digeser. */}
      <div className="sm:hidden">
        {category.candidates.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-muted">Belum ada kandidat di kategori ini.</p>
        ) : (
          <VoteBars candidates={category.candidates} winnerIds={isFinal ? category.winnerIds : []} />
        )}
      </div>
      <div className="-mx-1 hidden table-scroll px-1 sm:block">
        <table className="w-full min-w-[620px] border-collapse text-left text-sm">
          <caption className="sr-only">Rekapitulasi perolehan suara kategori {category.name}</caption>
          <thead>
            <tr className="border-b border-line-soft text-[11px] tracking-[0.06em] text-ink-muted uppercase">
              <th scope="col" className="w-16 pb-2.5 font-extrabold">
                No.
              </th>
              <th scope="col" className="pb-2.5 font-extrabold">
                Kandidat
              </th>
              <th scope="col" className="w-28 pb-2.5 text-right font-extrabold">
                Suara
              </th>
              <th scope="col" className="w-24 pb-2.5 text-right font-extrabold">
                Persentase
              </th>
              <th scope="col" className="w-[28%] pb-2.5 pl-5 font-extrabold">
                <span className="sr-only">Proporsi</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {category.candidates.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-sm text-ink-muted">
                  Belum ada kandidat di kategori ini.
                </td>
              </tr>
            ) : (
              category.candidates.map((candidate) => (
                <tr key={candidate.id} className="border-b border-canvas last:border-0">
                  <td className="py-3.5">
                    <CandidateBadge number={candidate.candidateNumber} size="sm" className="shadow-none" />
                  </td>
                  <td className="py-3.5">
                    <p className="flex flex-wrap items-center gap-2 font-bold">
                      {candidate.name}
                      {isFinal && category.winnerIds.includes(candidate.id) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-extrabold text-gold-ink">
                          <Trophy aria-hidden className="size-3" /> {category.tie ? 'Suara tertinggi (seri)' : 'Perolehan tertinggi'}
                        </span>
                      )}
                    </p>
                    <p className="text-[13px] text-ink-muted">{personMeta(candidate)}</p>
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
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-line text-[13px]">
              <th scope="row" colSpan={2} className="pt-3 font-bold">
                Total suara masuk
              </th>
              <td className="pt-3 text-right font-extrabold tabular-nums">{formatNumber(category.totalVotes)}</td>
              <td className="pt-3 text-right tabular-nums text-ink-body">{category.totalVotes ? '100%' : '0%'}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {isFinal && category.tie && (
        <p className="mt-3 text-[13px] font-semibold text-warning-ink">
          Terdapat perolehan suara tertinggi yang sama di kategori ini. Tindak lanjuti sesuai tata tertib pemilihan.
        </p>
      )}
    </section>
  );
}

export default function ResultsPage() {
  const results = useResults();
  const election = useElection();
  const queryClient = useQueryClient();
  const toast = useToast();
  const phase = election.data?.phase;
  const isFinal = phase === 'ended' || phase === 'closed';
  const published = election.data?.resultsPublished ?? false;
  const publishedAt = election.data?.resultsPublishedAt ?? null;
  const unlocked = election.data?.resultsUnlocked ?? false;
  const withheld = election.data?.resultsWithheld ?? false;
  const completed = results.data?.totals.completed ?? false;

  const exportCsv = useMutation({
    mutationFn: () => downloadFile('/admin/results/export.csv', `hasil-voting-osis-${wibDateKey(new Date())}.csv`),
    onSuccess: () => toast('File CSV hasil voting berhasil diunduh.', 'success'),
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const publish = useMutation({
    mutationFn: (next: boolean) =>
      api('/admin/election/results-publication', {
        method: 'PUT',
        body: { published: next },
      }),
    onSuccess: (_data, next) => {
      void queryClient.invalidateQueries({ queryKey: ['election'] });
      void queryClient.invalidateQueries({ queryKey: ['results'] });
      toast(next ? 'Hasil pemilihan diumumkan ke halaman publik.' : 'Pengumuman hasil ditarik dari halaman publik.', 'success');
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const categories = results.data?.categories ?? [];

  return (
    <>
      <AdminPageHeader
        title="Hasil Voting"
        actions={
          <button type="button" onClick={() => exportCsv.mutate()} disabled={exportCsv.isPending} className="btn btn-primary h-10">
            {exportCsv.isPending ? (
              <LoaderCircle aria-hidden className="size-4 animate-spin" />
            ) : (
              <Download aria-hidden className="size-4" />
            )}
            Export CSV
          </button>
        }
      />

      {!unlocked && phase && (
        <p className="flex items-start gap-2.5 rounded-card border border-warning-line bg-warning-bg px-4 py-3 text-[13px] leading-normal font-semibold text-warning-ink">
          <Info aria-hidden className="mt-px size-4 shrink-0" />
          Ini hasil sementara — pemungutan suara belum selesai. Angka di halaman ini bersifat internal dan belum terlihat oleh pemilih.
        </p>
      )}

      {results.isError && <ErrorNotice message={errorMessage(results.error)} onRetry={() => void results.refetch()} />}
      <StatCards totals={results.data?.totals} />

      <Panel
        title="Pengumuman Hasil"
        titleId="publikasi-judul"
        description="Hasil terbuka otomatis untuk umum saat jadwal berakhir, pemungutan suara ditutup, atau semua pemilih sudah memilih di semua kategorinya."
      >
        <div className="flex flex-wrap items-center gap-3">
          <p className={cn('text-sm font-bold', published ? 'text-success-ink' : withheld ? 'text-danger-ink' : 'text-ink-body')}>
            {published
              ? `Terbuka untuk umum${publishedAt ? ` sejak ${formatDateTime(publishedAt)}` : ''}`
              : withheld
                ? 'Ditahan panitia — halaman publik menampilkan pesan menunggu hasil'
                : 'Belum terbuka — perolehan suara belum terlihat oleh pemilih'}
          </p>
          <div className="flex flex-wrap gap-2.5 sm:ml-auto">
            {published && (
              <Link to="/terpilih" className="btn btn-outline h-10">
                <ExternalLink aria-hidden className="size-4" /> Lihat halaman Terpilih
              </Link>
            )}
            <button
              type="button"
              onClick={() => publish.mutate(!published)}
              disabled={publish.isPending || (!published && !unlocked)}
              title={
                !published && !unlocked
                  ? 'Hasil baru dapat dibuka setelah pemungutan suara selesai, ditutup, atau semua pemilih sudah memilih'
                  : undefined
              }
              className={cn('btn h-10', published ? 'btn-outline' : 'btn-primary')}
            >
              {publish.isPending ? (
                <LoaderCircle aria-hidden className="size-4 animate-spin" />
              ) : published ? (
                <Undo2 aria-hidden className="size-4" />
              ) : (
                <Megaphone aria-hidden className="size-4" />
              )}
              {published ? 'Tahan pengumuman' : 'Umumkan hasil'}
            </button>
          </div>
        </div>
        <ul className="mt-3 flex flex-col gap-1.5 text-[13px] text-ink-muted">
          <li className={cn(isFinal && 'font-semibold text-success-ink')}>
            {isFinal ? '✓' : '•'} Jadwal berakhir atau pemungutan suara ditutup di menu Jadwal Voting
          </li>
          <li className={cn(completed && 'font-semibold text-success-ink')}>
            {completed ? '✓' : '•'} Semua pemilih sudah memilih di semua kategori
            {results.data && ` (${results.data.totals.totalVotes} dari ${results.data.totals.expectedVotes} suara)`}
          </li>
        </ul>
        {!unlocked && (
          <p className="mt-2.5 text-[13px] text-ink-muted">
            Selama kedua syarat belum terpenuhi, halaman publik hanya menampilkan jadwal dan kandidat — bukan perolehan suara. Mengubah
            jadwal kembali ke masa pemungutan suara otomatis menutup hasil lagi.
          </p>
        )}
      </Panel>

      <Panel
        title="Rekapitulasi Perolehan Suara"
        titleId="rekap-judul"
        description={results.data ? `Data per ${formatClock(results.data.generatedAt)} WIB · diurutkan berdasarkan nomor urut` : undefined}
      >
        {results.data ? (
          categories.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">Belum ada kategori pemilihan.</p>
          ) : (
            <div className="flex flex-col gap-7">
              {categories.map((category) => (
                <CategoryTable key={category.id} category={category} isFinal={isFinal} />
              ))}
            </div>
          )
        ) : (
          <div aria-hidden className="h-56 animate-pulse rounded-card bg-line-soft" />
        )}
      </Panel>
    </>
  );
}
