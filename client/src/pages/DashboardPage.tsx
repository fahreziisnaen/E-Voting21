import { ArrowRight, CircleCheck, RefreshCw, Trophy } from 'lucide-react';
import { Link } from 'react-router';
import { CandidateCard, CandidateCardSkeleton } from '../features/student/CandidateCard';
import { CategoryTabs, useSelectedCategory } from '../features/student/CategoryTabs';
import { Hero } from '../features/student/Hero';
import { usePublicContext } from '../features/student/PublicLayout';
import { VoteBars } from '../features/student/VoteResults';
import { VotingSidebar } from '../features/student/VotingSidebar';
import { usePublicResults } from '../hooks/queries';
import { errorMessage } from '../lib/api';
import { formatNumber } from '../lib/format';
import { canVoteIn, VOTER_SCOPE_LABEL } from '../lib/voting';

/** Beranda publik: kategori & kandidat, jadwal, status, dan tata cara bisa dilihat tanpa login. */
export function DashboardPage() {
  const { me, meLoading, election, categories, votedCategoryIds, openDetail, pick } = usePublicContext();
  const isGuest = !meLoading && !me;
  const [category, selectCategory] = useSelectedCategory(categories.data);
  // Perolehan suara baru terisi setelah hasil resmi terbuka; selama voting berjalan tetap kosong.
  const results = usePublicResults();
  const categoryResult = results.data?.published ? results.data.categories.find((c) => c.id === category?.id) : undefined;
  const role = me?.user.role ?? null;
  const voted = category ? votedCategoryIds.has(category.id) : false;
  const notEligible = category && role && role !== 'admin' ? !canVoteIn(role, category.voterScope) : false;

  return (
    <>
      <Hero
        title={election.data?.electionName}
        categoryNames={categories.data?.map((c) => c.name) ?? []}
        photoUrl={election.data?.heroPhotoUrl ?? null}
        isGuest={isGuest}
      />

      <div className="mx-auto grid w-full max-w-[1380px] items-start gap-6 px-4 py-6 sm:px-7 sm:py-7 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section
          id="kandidat"
          aria-labelledby="kandidat-judul"
          aria-busy={categories.isPending}
          className="animate-fade-up min-w-0 scroll-mt-24 rounded-panel border border-line bg-white p-4 sm:p-[26px]"
        >
          <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
            <div className="min-w-0">
              <h2 id="kandidat-judul" className="text-[22px] font-extrabold sm:text-2xl">
                Daftar Kandidat
              </h2>
              <p className="mt-2 text-sm leading-normal text-ink-muted">
                Kenali visi, misi, dan program kerja kandidat di setiap kategori.
              </p>
            </div>
            <Link
              to={category ? `/kandidat?kategori=${category.id}` : '/kandidat'}
              className="inline-flex items-center gap-1.5 rounded-lg py-2 text-[13px] font-bold text-royal hover:text-navy-hover sm:ml-auto"
            >
              Profil lengkap kandidat <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          </div>

          {categories.isPending ? (
            <div className="mt-6 grid gap-[18px] md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <CandidateCardSkeleton key={i} />
              ))}
              <span className="sr-only" role="status">
                Memuat daftar kandidat…
              </span>
            </div>
          ) : categories.isError ? (
            <div role="alert" className="mt-6 rounded-card border border-danger-line bg-danger-bg p-6 text-center">
              <p className="font-bold text-danger-ink">Daftar kandidat gagal dimuat.</p>
              <p className="mt-1 text-sm text-danger-ink">{errorMessage(categories.error)}</p>
              <button type="button" onClick={() => void categories.refetch()} className="btn btn-outline mt-4 h-10">
                <RefreshCw aria-hidden className="size-4" /> Coba lagi
              </button>
            </div>
          ) : !category ? (
            <p className="mt-6 rounded-card border border-dashed border-line-strong p-8 text-center text-sm text-ink-muted">
              Belum ada kategori pemilihan. Silakan cek kembali nanti.
            </p>
          ) : (
            <>
              <div className="mt-5">
                <CategoryTabs
                  categories={categories.data}
                  selectedId={category.id}
                  onSelect={selectCategory}
                  role={role}
                  votedCategoryIds={votedCategoryIds}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-control bg-canvas px-4 py-3 text-[13px]">
                <span className="font-extrabold text-ink">{category.name}</span>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-ink-body ring-1 ring-line">
                  Pemilih: {VOTER_SCOPE_LABEL[category.voterScope]}
                </span>
                {category.description && <span className="basis-full text-ink-muted">{category.description}</span>}
                {voted && (
                  <span className="inline-flex items-center gap-1 font-bold text-success-ink sm:ml-auto">
                    <CircleCheck aria-hidden className="size-4" /> Anda sudah memilih di kategori ini
                  </span>
                )}
                {notEligible && <span className="font-bold text-ink-muted sm:ml-auto">Kategori ini tidak untuk peran Anda</span>}
              </div>

              {categoryResult && (
                <section
                  aria-labelledby="hasil-kategori-judul"
                  className="mt-4 rounded-card border-2 border-gold bg-gold-pale/20 p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <h3 id="hasil-kategori-judul" className="flex items-center gap-2 text-[15px] font-extrabold">
                      <Trophy aria-hidden className="size-4 text-gold-ink" /> Hasil resmi {categoryResult.name}
                    </h3>
                    <span className="text-[13px] text-ink-muted">{formatNumber(categoryResult.totalVotes)} suara sah</span>
                    <Link to="/terpilih" className="text-[13px] font-bold text-royal hover:text-navy-hover sm:ml-auto">
                      Lihat semua kategori
                    </Link>
                  </div>
                  <p className="mt-1.5 text-[13px] font-bold text-ink">
                    {categoryResult.winnerIds.length === 0
                      ? 'Belum ada suara yang masuk di kategori ini.'
                      : categoryResult.tie
                        ? `Hasil seri: ${categoryResult.candidates
                            .filter((c) => categoryResult.winnerIds.includes(c.id))
                            .map((c) => c.name)
                            .join(' dan ')}`
                        : `Terpilih: ${categoryResult.candidates.find((c) => c.id === categoryResult.winnerIds[0])?.name ?? '—'}`}
                  </p>
                  <div className="mt-3.5">
                    <VoteBars candidates={categoryResult.candidates} winnerIds={categoryResult.winnerIds} />
                  </div>
                </section>
              )}

              {category.candidates.length === 0 ? (
                <p className="mt-5 rounded-card border border-dashed border-line-strong p-8 text-center text-sm text-ink-muted">
                  Belum ada kandidat di kategori ini.
                </p>
              ) : (
                <div className="mt-5 grid gap-[18px] md:grid-cols-2 xl:grid-cols-4">
                  {category.candidates.map((candidate) => (
                    <CandidateCard key={candidate.id} candidate={candidate} onDetail={openDetail} onPick={pick} />
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <VotingSidebar
          election={election.data}
          categories={categories.data}
          me={me}
          votedCategoryIds={votedCategoryIds}
          isGuest={isGuest}
        />
      </div>
    </>
  );
}
