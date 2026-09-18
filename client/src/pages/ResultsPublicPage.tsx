import { ArrowRight, Hourglass, RefreshCw, Trophy, Users } from 'lucide-react';
import { Link } from 'react-router';
import { CandidateBadge, CandidatePhoto } from '../components/CandidateVisuals';
import { usePublicResults } from '../hooks/queries';
import { errorMessage } from '../lib/api';
import { cn } from '../lib/cn';
import { formatDateTime, formatNumber, formatPercent } from '../lib/format';
import { personMeta } from '../lib/voting';
import { VoteBars } from '../features/student/VoteResults';
import { usePublicContext } from '../features/student/PublicLayout';
import type { CandidateResult, CategoryResult, ElectionPhase } from '../types';

function pendingMessage(phase: ElectionPhase | undefined): string {
  if (phase === 'ended' || phase === 'closed') {
    return 'Pemungutan suara sudah selesai. Panitia sedang merekapitulasi suara, dan hasilnya tampil di halaman ini setelah diumumkan.';
  }
  return 'Hasil pemilihan diumumkan panitia setelah masa pemungutan suara selesai. Selama pemungutan suara berlangsung, perolehan suara tidak ditampilkan.';
}

/** Halaman publik "Terpilih": pemenang setiap kategori, hanya setelah panitia mengumumkan hasil. */
export function ResultsPublicPage() {
  const { election } = usePublicContext();
  const results = usePublicResults();
  const data = results.data;

  return (
    <>
      <section data-surface="navy" aria-labelledby="terpilih-judul" className="relative overflow-hidden bg-navy text-white">
        <div aria-hidden className="absolute -top-12 -left-16 hidden size-[140px] rotate-[38deg] bg-crimson opacity-90 lg:block" />
        <div aria-hidden className="absolute top-16 -left-[120px] hidden h-8 w-[190px] rotate-[38deg] bg-gold lg:block" />
        <div className="relative mx-auto max-w-[1380px] px-4 py-9 sm:px-7 sm:py-11 lg:pl-24">
          <div className="animate-fade-up">
            <p className="eyebrow text-gold">{election.data?.electionName ?? 'Pemilihan'}</p>
            <h1 id="terpilih-judul" className="mt-2 text-[30px] leading-tight font-extrabold sm:text-[40px]">
              Kandidat Terpilih
            </h1>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-on-navy">
              {data?.published && data.publishedAt
                ? `Hasil resmi diumumkan panitia pada ${formatDateTime(data.publishedAt)}.`
                : 'Pemenang setiap kategori pemilihan diumumkan di halaman ini.'}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1380px] px-4 py-7 sm:px-7" aria-busy={results.isPending}>
        {results.isPending ? (
          <div aria-hidden className="grid animate-pulse gap-5">
            {[0, 1].map((i) => (
              <div key={i} className="h-[320px] rounded-panel border border-line bg-white" />
            ))}
            <span className="sr-only" role="status">
              Memuat hasil pemilihan…
            </span>
          </div>
        ) : results.isError ? (
          <div role="alert" className="rounded-card border border-danger-line bg-danger-bg p-6 text-center">
            <p className="font-bold text-danger-ink">Hasil pemilihan gagal dimuat.</p>
            <p className="mt-1 text-sm text-danger-ink">{errorMessage(results.error)}</p>
            <button type="button" onClick={() => void results.refetch()} className="btn btn-outline mt-4 h-10">
              <RefreshCw aria-hidden className="size-4" /> Coba lagi
            </button>
          </div>
        ) : !data?.published ? (
          <div className="mx-auto max-w-[620px] rounded-panel border border-line bg-white px-6 py-10 text-center sm:px-10">
            <span aria-hidden className="mx-auto flex size-16 items-center justify-center rounded-full bg-gold-pale text-gold-ink">
              <Hourglass className="size-7" />
            </span>
            <h2 className="mt-5 text-[22px] font-extrabold">Hasil belum diumumkan</h2>
            <p className="mt-2.5 text-[15px] leading-relaxed text-pretty text-ink-muted">{pendingMessage(election.data?.phase)}</p>
            <div className="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row">
              <Link to="/kandidat" className="btn btn-primary h-11 px-5">
                Lihat Kandidat <ArrowRight aria-hidden className="size-4" />
              </Link>
              <Link to="/" className="btn btn-outline h-11 px-5">
                Kembali ke Beranda
              </Link>
            </div>
          </div>
        ) : data.categories.length === 0 ? (
          <p className="rounded-card border border-dashed border-line-strong bg-white p-10 text-center text-sm text-ink-muted">
            Belum ada kategori pemilihan.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {data.categories.map((category) => (
              <CategoryResultSection key={category.id} category={category} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function CategoryResultSection({ category }: { category: CategoryResult }) {
  const titleId = `hasil-kategori-${category.id}`;
  const winners = category.candidates.filter((c) => category.winnerIds.includes(c.id));

  return (
    <section aria-labelledby={titleId} className="animate-fade-up rounded-panel border border-line bg-white p-4 sm:p-[26px]">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="eyebrow text-royal">Kategori</p>
          <h2 id={titleId} className="mt-1 text-[22px] font-extrabold sm:text-2xl">
            {category.name}
          </h2>
          {category.description && <p className="mt-1.5 text-sm leading-normal text-ink-muted">{category.description}</p>}
        </div>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1.5 text-[13px] font-bold text-ink-body sm:ml-auto">
          <Users aria-hidden className="size-4" /> {formatNumber(category.totalVotes)} suara sah
        </p>
      </div>

      {category.totalVotes === 0 ? (
        <p className="mt-5 rounded-card border border-dashed border-line-strong p-8 text-center text-sm text-ink-muted">
          Tidak ada suara yang masuk di kategori ini.
        </p>
      ) : (
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <div className={cn('grid gap-4', winners.length > 1 && 'sm:grid-cols-2 lg:grid-cols-1')}>
            {winners.map((winner) => (
              <WinnerCard key={winner.id} candidate={winner} tie={category.tie} />
            ))}
            {category.tie && (
              <p role="note" className="rounded-control border border-warning-line bg-warning-bg px-3.5 py-3 text-[13px] leading-normal text-warning-ink">
                Perolehan suara tertinggi sama. Keputusan akhir mengikuti ketentuan panitia pemilihan.
              </p>
            )}
          </div>

          <div>
            <h3 className="text-[15px] font-extrabold">Perolehan suara</h3>
            <div className="mt-3">
              <VoteBars candidates={category.candidates} winnerIds={category.winnerIds} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function WinnerCard({ candidate, tie }: { candidate: CandidateResult; tie: boolean }) {
  return (
    <article className="flex gap-4 overflow-hidden rounded-card border-2 border-gold bg-gold-pale/25 p-3 sm:p-4">
      <div className="relative w-[112px] shrink-0 overflow-hidden rounded-control sm:w-[132px]">
        <div className="aspect-[4/5]">
          <CandidatePhoto photoUrl={candidate.photoUrl} name={candidate.name} />
        </div>
        <CandidateBadge number={candidate.candidateNumber} size="sm" className="absolute top-2 left-2" />
      </div>
      <div className="flex min-w-0 flex-col justify-center">
        <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-navy px-2.5 py-1 text-[11px] font-extrabold tracking-[0.06em] text-gold uppercase">
          <Trophy aria-hidden className="size-3.5" /> {tie ? 'Hasil seri' : 'Terpilih'}
        </p>
        <h3 className="mt-2 text-lg leading-snug font-extrabold text-balance sm:text-xl">{candidate.name}</h3>
        <p className="mt-0.5 text-[13px] text-ink-muted">{personMeta(candidate)}</p>
        <p className="mt-2.5 text-sm">
          <span className="text-[22px] font-extrabold text-ink">{formatNumber(candidate.votes)}</span>{' '}
          <span className="text-ink-muted">suara · {formatPercent(candidate.percentage)}</span>
        </p>
      </div>
    </article>
  );
}
