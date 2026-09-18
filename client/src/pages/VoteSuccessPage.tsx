import { ArrowRight, Check, CircleCheck, LogOut } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import type { VoteSuccessState } from '../features/student/PublicLayout';
import { useCategories, useElection, useLogout, useMe } from '../hooks/queries';
import { formatDateTime } from '../lib/format';
import { eligibleCategories } from '../lib/voting';

/** Tanda terima suara per kategori. Sengaja tidak menampilkan kandidat pilihan maupun hasil sementara. */
export function VoteSuccessPage() {
  const me = useMe().data!;
  const categories = useCategories();
  const election = useElection();
  const logout = useLogout();
  const navigate = useNavigate();
  const location = useLocation();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  if (me.votes.length === 0) return <Navigate to="/" replace />;

  const stateCategoryId = (location.state as VoteSuccessState | null)?.categoryId;
  const latest =
    me.votes.find((v) => v.categoryId === stateCategoryId) ??
    [...me.votes].sort((a, b) => b.votedAt.localeCompare(a.votedAt))[0]!;
  const votedIds = new Set(me.votes.map((v) => v.categoryId));
  const remaining = eligibleCategories(categories.data ?? [], me.user.role).filter((c) => !votedIds.has(c.id));
  const votingOpen = election.data?.isVotingOpen ?? false;
  const otherVotes = me.votes.filter((v) => v.categoryId !== latest.categoryId);

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12 sm:px-6">
      <div className="w-full max-w-[560px] animate-pop rounded-modal border border-line bg-white px-6 py-10 text-center sm:px-9 sm:py-11">
        <div className="mx-auto flex size-[92px] animate-ring items-center justify-center rounded-full border-2 border-success-line bg-success-bg">
          <span className="flex size-[58px] items-center justify-center rounded-full bg-success text-white">
            <Check aria-hidden strokeWidth={3.5} className="size-[30px]" />
          </span>
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="mt-6 text-2xl font-extrabold text-balance outline-none sm:text-[28px]">
          Suara Anda Berhasil Direkam!
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-pretty text-ink-muted">
          Terima kasih telah berpartisipasi. Suara Anda untuk kategori <strong className="text-ink">{latest.categoryName}</strong> sudah
          tercatat.
        </p>

        <dl className="mt-7 grid gap-2.5 rounded-xl border border-line bg-canvas p-4 text-left text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Kategori</dt>
            <dd className="text-right font-bold">{latest.categoryName}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Waktu voting</dt>
            <dd className="text-right font-bold">{formatDateTime(latest.votedAt)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">ID suara</dt>
            <dd className="text-right font-mono font-bold">{latest.receiptCode}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Status</dt>
            <dd className="text-right font-bold text-success-ink">Tercatat &amp; terverifikasi</dd>
          </div>
        </dl>

        {otherVotes.length > 0 && (
          <section aria-labelledby="bukti-lain" className="mt-5 text-left">
            <h2 id="bukti-lain" className="text-[13px] font-extrabold tracking-[0.04em] text-ink-muted uppercase">
              Bukti suara lainnya
            </h2>
            <ul className="mt-2 divide-y divide-line-soft rounded-xl border border-line">
              {otherVotes.map((vote) => (
                <li key={vote.categoryId} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm">
                  <CircleCheck aria-hidden className="size-4 shrink-0 text-success-ink" />
                  <span className="min-w-0 flex-1 font-bold">{vote.categoryName}</span>
                  <span className="font-mono text-[13px] font-bold">{vote.receiptCode}</span>
                  <span className="basis-full pl-7 text-xs text-ink-muted">{formatDateTime(vote.votedAt)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {categories.data && (
          <section aria-labelledby="kategori-sisa" className="mt-5 text-left">
            {remaining.length === 0 ? (
              <p id="kategori-sisa" className="rounded-xl border border-success-line bg-success-bg px-4 py-3 text-sm font-bold text-success-ink">
                Anda sudah memilih di semua kategori.
              </p>
            ) : (
              <>
                <h2 id="kategori-sisa" className="text-[13px] font-extrabold tracking-[0.04em] text-ink-muted uppercase">
                  Belum dipilih ({remaining.length})
                </h2>
                <ul className="mt-2 flex flex-col gap-2">
                  {remaining.map((category) => (
                    <li key={category.id}>
                      {votingOpen ? (
                        <Link
                          to={`/?kategori=${category.id}#kandidat`}
                          className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm font-bold transition-colors hover:border-royal hover:text-royal"
                        >
                          <span className="min-w-0 flex-1">{category.name}</span>
                          <span className="inline-flex items-center gap-1 text-[13px] text-royal">
                            Lanjut memilih <ArrowRight aria-hidden className="size-3.5" />
                          </span>
                        </Link>
                      ) : (
                        <span className="flex items-center rounded-xl border border-line px-4 py-3 text-sm font-bold text-ink-muted">
                          {category.name}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {!votingOpen && (
                  <p className="mt-2 text-[13px] text-ink-muted">Pemungutan suara sedang tidak dibuka, sehingga kategori ini belum bisa dipilih.</p>
                )}
              </>
            )}
          </section>
        )}

        <p className="mt-[18px] text-[13px] leading-normal text-ink-muted">
          Pilihan Anda bersifat rahasia. Hasil pemilihan diumumkan panitia setelah masa pemungutan suara ditutup.
        </p>

        <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
          <button type="button" onClick={() => navigate('/')} className="btn btn-primary h-[46px] sm:flex-1">
            Kembali ke Beranda
          </button>
          <button
            type="button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="btn btn-outline h-[46px] sm:flex-1"
          >
            <LogOut aria-hidden className="size-4" /> {logout.isPending ? 'Keluar…' : 'Logout'}
          </button>
        </div>
      </div>
    </main>
  );
}
