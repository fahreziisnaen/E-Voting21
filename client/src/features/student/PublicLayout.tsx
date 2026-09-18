import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router';
import type { LoginRedirectState } from '../../components/RouteGuards';
import { useToast } from '../../components/Toast';
import { meQuery, useCastVote, useCategories, useElection, useLogout, useMe } from '../../hooks/queries';
import { ApiError, errorMessage } from '../../lib/api';
import { PHASE_INFO } from '../../lib/election';
import { canVoteIn, VOTER_SCOPE_LABEL } from '../../lib/voting';
import type { Candidate, MeResponse } from '../../types';
import { CandidateDetailModal, ConfirmVoteModal } from './CandidateModals';
import { SiteFooter } from './SiteFooter';
import { StudentNavbar } from './StudentNavbar';

export interface PublicContext {
  /** null untuk pengunjung yang belum masuk. */
  me: MeResponse | null;
  meLoading: boolean;
  election: ReturnType<typeof useElection>;
  categories: ReturnType<typeof useCategories>;
  /** Kategori yang sudah dipilih pemilih yang sedang masuk. */
  votedCategoryIds: Set<number>;
  openDetail: (candidate: Candidate, trigger: HTMLElement) => void;
  /** "Pilih Kandidat": tamu diarahkan ke login; pemilih selalu melalui modal konfirmasi. */
  pick: (candidate: Candidate, trigger?: HTMLElement | null) => void;
  /** Modal detail/konfirmasi sedang terbuka (slide otomatis berhenti). */
  dialogOpen: boolean;
}

export function usePublicContext() {
  return useOutletContext<PublicContext>();
}

export interface VoteSuccessState {
  categoryId: number;
}

type Dialog = 'detail' | 'confirm' | null;

/** Kerangka halaman publik (Beranda, Kandidat, Terpilih): navbar, footer, dan alur memilih. */
export function PublicLayout() {
  const meResult = useMe();
  const me = meResult.data ?? null;
  const election = useElection();
  const categories = useCategories();
  const castVote = useCastVote();
  const logout = useLogout();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [dialog, setDialog] = useState<Dialog>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const isPreview = me?.user.role === 'admin';
  const allCandidates = useMemo(() => (categories.data ?? []).flatMap((c) => c.candidates), [categories.data]);
  const votedCategoryIds = useMemo(() => new Set((me?.votes ?? []).map((v) => v.categoryId)), [me]);
  const selected = allCandidates.find((c) => c.id === selectedId);
  const selectedCategory = categories.data?.find((c) => c.id === selected?.categoryId);

  // Pindah halaman → ke atas; tautan dengan #anchor (mis. dari halaman bukti suara) → ke bagian tersebut.
  useEffect(() => {
    const target = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    if (target?.scrollIntoView) target.scrollIntoView({ block: 'start' });
    else window.scrollTo({ top: 0 });
  }, [location.pathname, location.hash]);

  function openDetail(candidate: Candidate, trigger: HTMLElement) {
    triggerRef.current = trigger;
    setSelectedId(candidate.id);
    setDialog('detail');
  }

  // "Pilih Kandidat" tidak pernah langsung mengirim suara — selalu lewat modal konfirmasi.
  function pick(candidate: Candidate, trigger?: HTMLElement | null) {
    if (trigger) triggerRef.current = trigger;
    const category = categories.data?.find((c) => c.id === candidate.categoryId);
    if (isPreview) {
      toast('Mode pratinjau: akun panitia tidak dapat memberikan suara.');
      return;
    }
    if (election.data && !election.data.isVotingOpen) {
      toast(PHASE_INFO[election.data.phase].message, 'error');
      return;
    }
    if (!me) {
      setDialog(null);
      const state: LoginRedirectState = {
        from: location.pathname + location.search,
        pickCandidateId: candidate.id,
        pickCandidateName: `${candidate.name} (${candidate.categoryName})`,
      };
      navigate('/login', { state });
      return;
    }
    if (category && !canVoteIn(me.user.role, category.voterScope)) {
      toast(`Kategori ${category.name} hanya untuk ${VOTER_SCOPE_LABEL[category.voterScope].replace('Khusus ', '')}.`, 'error');
      return;
    }
    if (votedCategoryIds.has(candidate.categoryId)) {
      toast(
        `Anda sudah memberikan suara untuk kategori ${candidate.categoryName}. Setiap pemilih hanya dapat memilih satu kali per kategori.`,
        'error',
      );
      return;
    }
    setSelectedId(candidate.id);
    setDialog('confirm');
  }

  // Setelah login dari tombol "Pilih Kandidat": buka konfirmasi untuk kandidat tersebut.
  const pendingPickId = (location.state as { pickCandidateId?: number } | null)?.pickCandidateId;
  useEffect(() => {
    if (!pendingPickId || !me || !categories.data || !election.data) return;
    navigate(location.pathname + location.search, { replace: true, state: null });
    const candidate = allCandidates.find((c) => c.id === pendingPickId);
    if (candidate) pick(candidate);
    // pick sengaja tidak menjadi dependensi: dijalankan sekali saat data siap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPickId, me, categories.data, election.data]);

  async function submitVote() {
    if (castVote.isPending || !selected) return;
    try {
      await castVote.mutateAsync(selected.id);
      setDialog(null);
      const state: VoteSuccessState = { categoryId: selected.categoryId };
      navigate('/voting/berhasil', { state });
    } catch (err) {
      toast(errorMessage(err, 'Suara belum tersimpan. Silakan coba lagi.'), 'error');
      // Server menolak karena sudah memilih / di luar jadwal / tidak berhak: tutup modal & segarkan status.
      if (err instanceof ApiError && (err.status === 409 || err.status === 403 || err.status === 401)) {
        setDialog(null);
        void queryClient.invalidateQueries({ queryKey: meQuery.queryKey });
        void election.refetch();
      }
    }
  }

  const context: PublicContext = {
    me,
    meLoading: meResult.isPending,
    election,
    categories,
    votedCategoryIds,
    openDetail,
    pick,
    dialogOpen: dialog !== null,
  };

  return (
    <div className="flex min-h-screen flex-col">
      <StudentNavbar
        user={me?.user ?? null}
        loading={meResult.isPending}
        onLogout={() => logout.mutate()}
        loggingOut={logout.isPending}
      />

      {isPreview && (
        <div className="border-b border-warning-line bg-warning-bg">
          <div className="mx-auto flex max-w-[1380px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-[13px] font-semibold text-warning-ink sm:px-7">
            Anda melihat tampilan pemilih sebagai panitia. Tombol pilih dinonaktifkan.
            <Link to="/admin" className="inline-flex items-center gap-1 font-bold text-navy hover:underline">
              <ArrowLeft aria-hidden className="size-3.5" /> Kembali ke panel panitia
            </Link>
          </div>
        </div>
      )}

      <main id="konten" tabIndex={-1} className="flex-1 outline-none">
        <Outlet context={context} />
      </main>

      <SiteFooter />

      <CandidateDetailModal
        candidate={selected}
        open={dialog === 'detail'}
        onClose={() => setDialog(null)}
        onPick={(candidate) => pick(candidate)}
        returnFocusRef={triggerRef}
      />
      <ConfirmVoteModal
        candidate={selected}
        categoryName={selectedCategory?.name ?? selected?.categoryName}
        open={dialog === 'confirm'}
        submitting={castVote.isPending}
        onCancel={() => setDialog(null)}
        onConfirm={() => void submitVote()}
        returnFocusRef={triggerRef}
      />
    </div>
  );
}
