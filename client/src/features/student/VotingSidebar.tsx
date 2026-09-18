import { CalendarDays, CircleCheck, CircleDashed, CircleMinus, Clock, Eye, LogIn, Trophy } from 'lucide-react';
import { Link } from 'react-router';
import type { LoginRedirectState } from '../../components/RouteGuards';
import { cn } from '../../lib/cn';
import { PHASE_INFO, TONE_BADGE } from '../../lib/election';
import { formatDateRange, formatTimeRange } from '../../lib/format';
import { canVoteIn, eligibleCategories, VOTER_SCOPE_LABEL } from '../../lib/voting';
import type { Category, Election, MeResponse } from '../../types';

const STEPS = [
  'Masuk dengan NIS (siswa) atau username (guru) beserta kode akses dari panitia.',
  'Buka kategori, lalu pilih satu kandidat.',
  'Periksa kembali pilihan Anda.',
  'Konfirmasi suara.',
  'Ulangi untuk kategori lainnya hingga selesai.',
];

const LOGIN_STATE: LoginRedirectState = { from: '/' };

interface VotingSidebarProps {
  election: Election | undefined;
  categories: Category[] | undefined;
  me: MeResponse | null;
  votedCategoryIds: Set<number>;
  /** Pengunjung yang belum masuk. */
  isGuest: boolean;
}

export function VotingSidebar({ election, categories, me, votedCategoryIds, isGuest }: VotingSidebarProps) {
  const phase = election ? PHASE_INFO[election.phase] : null;
  const isPreview = me?.user.role === 'admin';
  const eligible = me && !isPreview ? eligibleCategories(categories ?? [], me.user.role) : [];
  const done = eligible.filter((c) => votedCategoryIds.has(c.id)).length;
  const closedHint = election && !election.isVotingOpen ? PHASE_INFO[election.phase].message : null;

  return (
    <aside aria-label="Informasi pemungutan suara" className="grid min-w-0 content-start items-start gap-4 md:grid-cols-2 xl:grid-cols-1">
      <section aria-labelledby="jadwal-title" className="rounded-card border border-line bg-white p-[18px]">
        <div className="mb-3.5 flex items-center gap-2.5">
          <span aria-hidden className="flex size-[34px] items-center justify-center rounded-button bg-royal-soft text-royal">
            <CalendarDays className="size-[18px]" />
          </span>
          <h2 id="jadwal-title" className="text-[15px] font-extrabold">
            Jadwal Pemungutan Suara
          </h2>
        </div>
        {election ? (
          <dl className="flex flex-col gap-2.5 text-sm">
            <div className="flex justify-between gap-2.5">
              <dt className="flex items-center gap-1.5 text-ink-muted">
                <CalendarDays aria-hidden className="size-3.5" /> Tanggal
              </dt>
              <dd className="text-right font-bold">{formatDateRange(election.startDate, election.endDate)}</dd>
            </div>
            <div className="flex justify-between gap-2.5">
              <dt className="flex items-center gap-1.5 text-ink-muted">
                <Clock aria-hidden className="size-3.5" /> Waktu
              </dt>
              <dd className="text-right font-bold">{formatTimeRange(election.startDate, election.endDate)}</dd>
            </div>
          </dl>
        ) : (
          <div aria-hidden className="space-y-2.5">
            <div className="h-4 animate-pulse rounded bg-line-soft" />
            <div className="h-4 animate-pulse rounded bg-line-soft" />
          </div>
        )}
      </section>

      <section aria-labelledby="status-title" aria-live="polite" className="rounded-card border border-line bg-white p-[18px]">
        <div className="mb-3 flex items-center gap-2.5">
          <h2 id="status-title" className="text-[15px] font-extrabold">
            Status Voting
          </h2>
          {phase && (
            <span className={cn('ml-auto rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-[0.06em] uppercase', TONE_BADGE[phase.tone])}>
              {phase.label}
            </span>
          )}
        </div>

        {isGuest ? (
          <>
            <p className="flex items-center gap-2 text-[15px] font-bold text-royal">
              <LogIn aria-hidden className="size-[18px] shrink-0" /> Masuk untuk memberikan suara
            </p>
            <p className="mt-1.5 text-[13px] leading-normal text-ink-muted">
              {closedHint ?? 'Siswa memakai NIS, guru memakai username, beserta kode akses dari panitia.'}
            </p>
            <Link to="/login" state={LOGIN_STATE} className="btn btn-primary mt-3.5 h-10 w-full">
              <LogIn aria-hidden className="size-4" /> Masuk untuk Memilih
            </Link>
          </>
        ) : isPreview ? (
          <>
            <p className="flex items-center gap-2 text-[15px] font-bold text-warning-ink">
              <Eye aria-hidden className="size-[18px] shrink-0" /> Mode pratinjau panitia
            </p>
            <p className="mt-1.5 text-[13px] leading-normal text-ink-muted">Akun panitia tidak dapat memberikan suara.</p>
          </>
        ) : me ? (
          <>
            <p className={cn('text-[15px] font-bold', done === eligible.length && eligible.length ? 'text-success-ink' : 'text-warning-ink')}>
              {eligible.length === 0
                ? 'Belum ada kategori untuk Anda'
                : done === eligible.length
                  ? 'Anda sudah memilih di semua kategori'
                  : `Sudah memilih ${done} dari ${eligible.length} kategori`}
            </p>
            {closedHint && <p className="mt-1.5 text-[13px] leading-normal text-ink-muted">{closedHint}</p>}
            <ul className="mt-3 flex flex-col gap-2">
              {(categories ?? []).map((category) => {
                const allowed = canVoteIn(me.user.role, category.voterScope);
                const voted = votedCategoryIds.has(category.id);
                return (
                  <li key={category.id} className="flex items-center gap-2 text-[13px]">
                    {!allowed ? (
                      <CircleMinus aria-hidden className="size-4 shrink-0 text-ink-subtle" />
                    ) : voted ? (
                      <CircleCheck aria-hidden className="size-4 shrink-0 text-success-ink" />
                    ) : (
                      <CircleDashed aria-hidden className="size-4 shrink-0 text-warning-ink" />
                    )}
                    <span className={cn('min-w-0 flex-1 truncate font-semibold', !allowed && 'text-ink-muted')}>{category.name}</span>
                    <span className={cn('shrink-0', !allowed ? 'text-ink-muted' : voted ? 'text-success-ink' : 'text-warning-ink')}>
                      {!allowed ? VOTER_SCOPE_LABEL[category.voterScope] : voted ? 'Sudah' : 'Belum'}
                    </span>
                  </li>
                );
              })}
            </ul>
            {done > 0 && (
              <Link to="/voting/berhasil" className="mt-2 inline-block py-1.5 text-[13px] font-bold text-royal hover:text-navy-hover">
                Lihat bukti suara
              </Link>
            )}
          </>
        ) : (
          <div aria-hidden className="h-12 animate-pulse rounded bg-line-soft" />
        )}
      </section>

      {election?.resultsPublished && (
        <section aria-labelledby="hasil-title" className="rounded-card border-2 border-gold bg-gold-pale/20 p-[18px]">
          <h2 id="hasil-title" className="flex items-center gap-2 text-[15px] font-extrabold">
            <Trophy aria-hidden className="size-[18px] text-gold-ink" /> Hasil sudah diumumkan
          </h2>
          <p className="mt-1.5 text-[13px] leading-normal text-ink-body">
            Perolehan suara setiap kandidat kini terbuka untuk umum.
          </p>
          <Link to="/terpilih" className="btn btn-primary mt-3 h-10 w-full">
            Lihat Kandidat Terpilih
          </Link>
        </section>
      )}

      <section id="tatacara" aria-labelledby="tatacara-title" className="scroll-mt-24 rounded-card border border-line bg-white p-[18px]">
        <h2 id="tatacara-title" className="mb-3.5 text-[15px] font-extrabold">
          Tata Cara Voting
        </h2>
        <ol className="flex flex-col gap-3">
          {STEPS.map((step, index) => (
            <li key={step} className="flex items-start gap-2.5">
              <span
                aria-hidden
                className={cn(
                  'flex size-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white',
                  index === STEPS.length - 1 ? 'bg-success-ink' : 'bg-navy',
                )}
              >
                {index + 1}
              </span>
              <span className="text-[13px] leading-normal text-ink-body">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <div role="note" className="flex gap-3 rounded-card border border-danger-line bg-danger-bg p-4">
        <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-danger text-sm font-extrabold text-white">
          !
        </span>
        <p className="text-[13px] leading-normal font-semibold text-danger-ink">
          Setiap pemilih hanya dapat memilih satu kali di setiap kategori. Pastikan pilihan Anda sudah benar sebelum konfirmasi.
        </p>
      </div>
    </aside>
  );
}
