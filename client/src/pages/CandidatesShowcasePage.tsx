import { CalendarDays, ChevronLeft, ChevronRight, Clock, LogIn, Pause, Play, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { CandidateBadge, CandidatePhoto } from '../components/CandidateVisuals';
import type { LoginRedirectState } from '../components/RouteGuards';
import { CategoryTabs, useSelectedCategory } from '../features/student/CategoryTabs';
import { usePublicContext } from '../features/student/PublicLayout';
import { errorMessage } from '../lib/api';
import { candidateAccent } from '../lib/candidates';
import { cn } from '../lib/cn';
import { PHASE_INFO, TONE_BADGE } from '../lib/election';
import { formatDateRange, formatTimeRange } from '../lib/format';
import { personMeta, VOTER_SCOPE_LABEL } from '../lib/voting';
import type { Candidate } from '../types';

/** Lama tiap slide sebelum berganti otomatis. */
export const AUTOPLAY_MS = 8000;

/** Jeda otomatis hanya saat fokus berasal dari keyboard (bukan klik mouse). */
function isKeyboardFocus(element: Element): boolean {
  try {
    return element.matches(':focus-visible');
  } catch {
    return false;
  }
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="eyebrow text-ink-muted">{title}</h3>
      {children}
    </section>
  );
}

function CandidateSlide({
  candidate,
  position,
  total,
  direction,
  isGuest,
  voted,
  onPick,
}: {
  candidate: Candidate;
  position: number;
  total: number;
  direction: 'next' | 'prev';
  isGuest: boolean;
  voted: boolean;
  onPick: (trigger: HTMLElement) => void;
}) {
  const accent = candidateAccent(candidate.candidateNumber);
  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={`${position} dari ${total}: ${candidate.name}`}
      className={cn(
        'grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]',
        direction === 'next' ? 'animate-slide-in-right' : 'animate-slide-in-left',
      )}
    >
      <div className="relative aspect-[4/5] max-h-[70vh] w-full lg:aspect-auto lg:max-h-none lg:min-h-[560px]">
        <CandidatePhoto photoUrl={candidate.photoUrl} name={candidate.name} className="lg:absolute lg:inset-0" />
        <CandidateBadge number={candidate.candidateNumber} size="xl" className="absolute top-5 left-5" />
      </div>

      <div className="flex flex-col p-6 sm:p-8 lg:p-10">
        <p className={cn('eyebrow', accent.label)}>
          {candidate.categoryName} · Nomor {candidate.candidateNumber}
        </p>
        <h2 className="mt-2 text-[28px] leading-tight font-extrabold sm:text-[36px]">{candidate.name}</h2>
        <p className="mt-1 text-[15px] text-ink-muted">{personMeta(candidate)}</p>

        <blockquote
          className={cn('mt-6 border-l-4 pl-4 text-lg leading-relaxed font-semibold text-pretty sm:text-xl', accent.border)}
        >
          <span className="sr-only">Visi: </span>“{candidate.vision}”
        </blockquote>

        <div className="mt-7 grid gap-6 md:grid-cols-2">
          {candidate.mission.length > 0 && (
            <ProfileSection title="Misi">
              <ol className="mt-2.5 flex flex-col gap-2 text-sm leading-normal text-ink-body">
                {candidate.mission.map((item, index) => (
                  <li key={item} className="flex gap-2.5">
                    <span
                      aria-hidden
                      className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-line-soft text-[11px] font-extrabold text-navy"
                    >
                      {index + 1}
                    </span>
                    {item}
                  </li>
                ))}
              </ol>
            </ProfileSection>
          )}
          <div className="flex flex-col gap-6">
            {candidate.programs.length > 0 && (
              <ProfileSection title="Program Kerja Unggulan">
                <ul className="mt-2.5 flex flex-wrap gap-2">
                  {candidate.programs.map((program) => (
                    <li key={program} className="rounded-full border border-line bg-canvas px-3 py-[7px] text-[13px] font-semibold">
                      {program}
                    </li>
                  ))}
                </ul>
              </ProfileSection>
            )}
            {candidate.organizationHistory.length > 0 && (
              <ProfileSection title="Riwayat Organisasi">
                <ul className="mt-2.5 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-normal text-ink-body marker:text-ink-subtle">
                  {candidate.organizationHistory.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </ProfileSection>
            )}
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-8">
          <button
            type="button"
            onClick={(e) => onPick(e.currentTarget)}
            className={cn('btn h-12 px-6 text-[15px] transition-[filter]', accent.button)}
          >
            Pilih Kandidat Ini<span className="sr-only">: {candidate.name}</span>
          </button>
          {isGuest && <p className="text-[13px] text-ink-muted">Anda akan diminta masuk terlebih dahulu.</p>}
          {voted && <p className="text-[13px] font-semibold text-success-ink">Anda sudah memilih di kategori ini.</p>}
        </div>
      </div>
    </div>
  );
}

/** Halaman Kandidat: profil lengkap tiap kandidat dalam slide yang berganti otomatis. */
export function CandidatesShowcasePage() {
  const { me, meLoading, election, categories, votedCategoryIds, pick, dialogOpen } = usePublicContext();
  const location = useLocation();
  const [category, selectCategory] = useSelectedCategory(categories.data);
  const list = category?.candidates ?? [];
  const count = list.length;
  const isGuest = !meLoading && !me;

  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const [hovered, setHovered] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const elapsed = useRef(0);
  const progressRef = useRef<HTMLDivElement>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const current = count ? Math.min(index, count - 1) : 0;
  const active = list[current];
  const paused = !playing || hovered || keyboardFocus || tabHidden || dialogOpen || count < 2;

  // Kembali dari login lewat "Pilih Kandidat Ini": tampilkan kandidat yang sedang dikonfirmasi.
  const returningPickId = useRef((location.state as { pickCandidateId?: number } | null)?.pickCandidateId);

  const go = useCallback(
    (target: number, dir: 'next' | 'prev') => {
      if (!count) return;
      elapsed.current = 0;
      setDirection(dir);
      setIndex(((target % count) + count) % count);
    },
    [count],
  );

  // Ganti kategori → mulai dari kandidat pertama.
  useEffect(() => {
    elapsed.current = 0;
    setIndex(0);
  }, [category?.id]);

  useEffect(() => {
    if (!returningPickId.current || !count) return;
    const position = list.findIndex((c) => c.id === returningPickId.current);
    returningPickId.current = undefined;
    if (position >= 0) setIndex(position);
  }, [count, list]);

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Timer autoplay: progress bar diperbarui langsung lewat ref agar halaman tidak dirender ulang tiap frame.
  useEffect(() => {
    const setProgress = (value: number) => {
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${value})`;
    };
    setProgress(elapsed.current / AUTOPLAY_MS);
    if (paused) return;
    let frame = 0;
    const startedAt = performance.now() - elapsed.current;
    const tick = (now: number) => {
      elapsed.current = now - startedAt;
      if (elapsed.current >= AUTOPLAY_MS) {
        go(current + 1, 'next');
        return;
      }
      setProgress(elapsed.current / AUTOPLAY_MS);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused, current, go]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(current + 1, 'next');
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(current - 1, 'prev');
    }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse') swipeStart.current = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(current + (dx < 0 ? 1 : -1), dx < 0 ? 'next' : 'prev');
  }

  const phase = election.data ? PHASE_INFO[election.data.phase] : null;
  const loginState: LoginRedirectState = { from: location.pathname + location.search };

  return (
    <>
      <section data-surface="navy" aria-labelledby="kandidat-halaman-judul" className="relative overflow-hidden bg-navy text-white">
        <div aria-hidden className="absolute -top-12 -left-16 hidden size-[140px] rotate-[38deg] bg-crimson opacity-90 lg:block" />
        <div aria-hidden className="absolute top-16 -left-[120px] hidden h-8 w-[190px] rotate-[38deg] bg-gold lg:block" />
        <div className="relative mx-auto flex max-w-[1380px] flex-wrap items-end gap-x-10 gap-y-6 px-4 py-9 sm:px-7 sm:py-11 lg:pl-24">
          <div className="min-w-0 animate-fade-up">
            <p className="eyebrow text-gold">{election.data?.electionName ?? 'Pemilihan'}</p>
            <h1 id="kandidat-halaman-judul" className="mt-2 text-[30px] leading-tight font-extrabold sm:text-[40px]">
              Profil Kandidat
            </h1>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-on-navy">
              Kenali visi, misi, program kerja, dan pengalaman organisasi kandidat di setiap kategori sebelum memberikan suara.
            </p>
            {isGuest && (
              <Link to="/login" state={loginState} className="btn mt-5 h-11 bg-gold px-5 text-ink hover:bg-gold-bright">
                <LogIn aria-hidden className="size-4" /> Masuk untuk Memilih
              </Link>
            )}
          </div>
          {election.data && phase && (
            <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm lg:ml-auto">
              <div>
                <dt className="flex items-center gap-1.5 text-on-navy-muted">
                  <CalendarDays aria-hidden className="size-3.5" /> Tanggal
                </dt>
                <dd className="mt-0.5 font-bold">{formatDateRange(election.data.startDate, election.data.endDate)}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-on-navy-muted">
                  <Clock aria-hidden className="size-3.5" /> Waktu
                </dt>
                <dd className="mt-0.5 font-bold">{formatTimeRange(election.data.startDate, election.data.endDate)}</dd>
              </div>
              <div>
                <dt className="text-on-navy-muted">Status</dt>
                <dd className="mt-1">
                  <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-[0.06em] uppercase', TONE_BADGE[phase.tone])}>
                    {phase.label}
                  </span>
                </dd>
              </div>
            </dl>
          )}
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1380px] px-4 py-7 sm:px-7">
        {categories.isPending ? (
          <div aria-hidden className="grid animate-pulse overflow-hidden rounded-modal border border-line bg-white lg:grid-cols-[420px_1fr]">
            <div className="aspect-[4/5] bg-line-soft lg:aspect-auto lg:min-h-[560px]" />
            <div className="space-y-4 p-10">
              <div className="h-4 w-40 rounded bg-line-soft" />
              <div className="h-9 w-2/3 rounded bg-line-soft" />
              <div className="h-20 rounded bg-line-soft" />
              <div className="h-40 rounded bg-line-soft" />
            </div>
            <span className="sr-only" role="status">
              Memuat kandidat…
            </span>
          </div>
        ) : categories.isError ? (
          <div role="alert" className="rounded-card border border-danger-line bg-danger-bg p-6 text-center">
            <p className="font-bold text-danger-ink">Data kandidat gagal dimuat.</p>
            <p className="mt-1 text-sm text-danger-ink">{errorMessage(categories.error)}</p>
            <button type="button" onClick={() => void categories.refetch()} className="btn btn-outline mt-4 h-10">
              <RefreshCw aria-hidden className="size-4" /> Coba lagi
            </button>
          </div>
        ) : (
          <>
          {category && (
            <div className="mb-5 flex flex-col gap-3">
              <CategoryTabs
                categories={categories.data}
                selectedId={category.id}
                onSelect={selectCategory}
                role={me?.user.role ?? null}
                votedCategoryIds={votedCategoryIds}
              />
              <p className="text-[13px] text-ink-muted">
                <span className="font-bold text-ink">{category.name}</span> · Pemilih: {VOTER_SCOPE_LABEL[category.voterScope]}
                {category.description ? ` · ${category.description}` : ''}
              </p>
            </div>
          )}
          {!active ? (
          <p className="rounded-card border border-dashed border-line-strong bg-white p-10 text-center text-sm text-ink-muted">
            {category ? 'Belum ada kandidat di kategori ini.' : 'Belum ada kategori pemilihan. Silakan cek kembali nanti.'}
          </p>
        ) : (
          <div
            role="region"
            aria-roledescription="carousel"
            aria-label={`Profil kandidat ${category?.name ?? 'pemilihan'}`}
            onKeyDown={onKeyDown}
            onFocus={(e) => setKeyboardFocus(isKeyboardFocus(e.target))}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setKeyboardFocus(false);
            }}
          >
            <div
              className="relative touch-pan-y overflow-hidden rounded-modal border border-line bg-white"
              onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(true)}
              onPointerLeave={() => setHovered(false)}
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
              onPointerCancel={() => (swipeStart.current = null)}
            >
              <div aria-hidden className="h-1 bg-line-soft">
                <div
                  ref={progressRef}
                  className={cn('h-full origin-left', candidateAccent(active.candidateNumber).bar)}
                  style={{ transform: 'scaleX(0)' }}
                />
              </div>
              <div aria-live={paused ? 'polite' : 'off'}>
                <CandidateSlide
                  key={active.id}
                  candidate={active}
                  position={current + 1}
                  total={count}
                  direction={direction}
                  isGuest={isGuest}
                  voted={votedCategoryIds.has(active.categoryId)}
                  onPick={(trigger) => pick(active, trigger)}
                />
              </div>
            </div>

            {count > 1 && (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => go(current - 1, 'prev')}
                  aria-label="Kandidat sebelumnya"
                  className="btn btn-outline size-11 rounded-full p-0"
                >
                  <ChevronLeft aria-hidden className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPlaying((value) => !value)}
                  aria-pressed={!playing}
                  className="btn btn-outline h-11 rounded-full px-4"
                >
                  {playing ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
                  {playing ? 'Jeda slide' : 'Putar slide'}
                </button>
                <button
                  type="button"
                  onClick={() => go(current + 1, 'next')}
                  aria-label="Kandidat berikutnya"
                  className="btn btn-outline size-11 rounded-full p-0"
                >
                  <ChevronRight aria-hidden className="size-5" />
                </button>
                <p className="text-[13px] text-ink-muted sm:ml-auto" aria-live="polite">
                  Kandidat {current + 1} dari {count}
                  {playing && paused && !tabHidden ? ' · berhenti sementara' : ''}
                </p>
              </div>
            )}

            <div role="group" aria-label="Pilih kandidat untuk ditampilkan" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {list.map((candidate, position) => {
                const selected = position === current;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => go(position, position < current ? 'prev' : 'next')}
                    className={cn(
                      'flex items-center gap-3 rounded-card border-2 bg-white p-2.5 text-left transition-colors',
                      selected ? candidateAccent(candidate.candidateNumber).border : 'border-line hover:border-line-strong',
                    )}
                  >
                    <span aria-hidden className="relative size-14 shrink-0 overflow-hidden rounded-control">
                      <CandidatePhoto photoUrl={candidate.photoUrl} name={candidate.name} className="[&>span]:hidden" />
                    </span>
                    <CandidateBadge number={candidate.candidateNumber} size="sm" className="shadow-none" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{candidate.name}</span>
                      <span className="block truncate text-xs text-ink-muted">{personMeta(candidate)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </>
  );
}
