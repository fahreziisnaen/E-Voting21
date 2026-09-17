import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useToast } from '../components/Toast';
import { CandidateCard, CandidateCardSkeleton } from '../features/student/CandidateCard';
import { CandidateDetailModal, ConfirmVoteModal } from '../features/student/CandidateModals';
import { Hero } from '../features/student/Hero';
import { SiteFooter } from '../features/student/SiteFooter';
import { StudentNavbar } from '../features/student/StudentNavbar';
import { VotingSidebar } from '../features/student/VotingSidebar';
import { meQuery, useCandidates, useCastVote, useElection, useLogout, useMe } from '../hooks/queries';
import { ApiError, errorMessage } from '../lib/api';
import { PHASE_INFO } from '../lib/election';
import type { Candidate } from '../types';

type Dialog = 'detail' | 'confirm' | null;

export function DashboardPage() {
  const me = useMe().data!;
  const election = useElection();
  const candidates = useCandidates();
  const castVote = useCastVote();
  const logout = useLogout();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [dialog, setDialog] = useState<Dialog>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const isPreview = me.user.role === 'admin';
  const selected = candidates.data?.find((c) => c.id === selectedId);

  function openDetail(candidate: Candidate, trigger: HTMLElement) {
    triggerRef.current = trigger;
    setSelectedId(candidate.id);
    setDialog('detail');
  }

  // "Pilih Kandidat" tidak pernah langsung mengirim suara — selalu lewat modal konfirmasi.
  function askConfirm(candidate: Candidate, trigger?: HTMLElement) {
    if (trigger) triggerRef.current = trigger;
    if (isPreview) {
      toast('Mode pratinjau: akun panitia tidak dapat memberikan suara.');
      return;
    }
    if (me.hasVoted) {
      toast('Anda sudah memberikan suara. Setiap siswa hanya dapat memilih satu kali.', 'error');
      return;
    }
    if (election.data && !election.data.isVotingOpen) {
      toast(PHASE_INFO[election.data.phase].message, 'error');
      return;
    }
    setSelectedId(candidate.id);
    setDialog('confirm');
  }

  async function submitVote() {
    if (castVote.isPending || selectedId === null) return;
    try {
      await castVote.mutateAsync(selectedId);
      setDialog(null);
      navigate('/voting/berhasil');
    } catch (err) {
      toast(errorMessage(err, 'Suara belum tersimpan. Silakan coba lagi.'), 'error');
      // Server menolak karena sudah memilih / di luar jadwal: tutup modal & segarkan status.
      if (err instanceof ApiError && (err.status === 409 || err.status === 403)) {
        setDialog(null);
        void queryClient.invalidateQueries({ queryKey: meQuery.queryKey });
        void election.refetch();
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <StudentNavbar user={me.user} onLogout={() => logout.mutate()} loggingOut={logout.isPending} />

      {isPreview && (
        <div className="border-b border-warning-line bg-warning-bg">
          <div className="mx-auto flex max-w-[1380px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-[13px] font-semibold text-warning-ink sm:px-7">
            Anda melihat tampilan siswa sebagai panitia. Tombol pilih dinonaktifkan.
            <Link to="/admin" className="inline-flex items-center gap-1 font-bold text-navy hover:underline">
              <ArrowLeft aria-hidden className="size-3.5" /> Kembali ke panel panitia
            </Link>
          </div>
        </div>
      )}

      <main className="flex-1">
        <Hero photoUrl={election.data?.heroPhotoUrl ?? null} />

        <div className="mx-auto grid w-full max-w-[1380px] items-start gap-6 px-4 py-6 sm:px-7 sm:py-7 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section
            id="kandidat"
            aria-labelledby="kandidat-judul"
            aria-busy={candidates.isPending}
            className="animate-fade-up scroll-mt-24 rounded-panel border border-line bg-white p-4 sm:p-[26px]"
          >
            <h2 id="kandidat-judul" className="text-[22px] font-extrabold sm:text-2xl">
              Daftar Kandidat Ketua OSIS
            </h2>
            <p className="mt-2 mb-6 text-sm leading-normal text-ink-muted">
              Kenali visi, misi, dan program kerja dari setiap kandidat.
            </p>

            {candidates.isPending ? (
              <div className="grid gap-[18px] md:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <CandidateCardSkeleton key={i} />
                ))}
                <span className="sr-only" role="status">
                  Memuat daftar kandidat…
                </span>
              </div>
            ) : candidates.isError ? (
              <div role="alert" className="rounded-card border border-danger-line bg-danger-bg p-6 text-center">
                <p className="font-bold text-danger-ink">Daftar kandidat gagal dimuat.</p>
                <p className="mt-1 text-sm text-danger-ink">{errorMessage(candidates.error)}</p>
                <button type="button" onClick={() => void candidates.refetch()} className="btn btn-outline mt-4 h-10">
                  <RefreshCw aria-hidden className="size-4" /> Coba lagi
                </button>
              </div>
            ) : candidates.data.length === 0 ? (
              <p className="rounded-card border border-dashed border-line-strong p-8 text-center text-sm text-ink-muted">
                Belum ada kandidat yang terdaftar. Silakan cek kembali nanti.
              </p>
            ) : (
              <div className="grid gap-[18px] md:grid-cols-2 xl:grid-cols-4">
                {candidates.data.map((candidate) => (
                  <CandidateCard key={candidate.id} candidate={candidate} onDetail={openDetail} onPick={askConfirm} />
                ))}
              </div>
            )}
          </section>

          <VotingSidebar election={election.data} hasVoted={me.hasVoted} isPreview={isPreview} />
        </div>
      </main>

      <SiteFooter />

      <CandidateDetailModal
        candidate={selected}
        open={dialog === 'detail'}
        onClose={() => setDialog(null)}
        onPick={(candidate) => askConfirm(candidate)}
        returnFocusRef={triggerRef}
      />
      <ConfirmVoteModal
        candidate={selected}
        open={dialog === 'confirm'}
        submitting={castVote.isPending}
        onCancel={() => setDialog(null)}
        onConfirm={() => void submitVote()}
        returnFocusRef={triggerRef}
      />
    </div>
  );
}
