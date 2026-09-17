import { Check, LogOut } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useLogout, useMe } from '../hooks/queries';
import { formatDateTime } from '../lib/format';

export function VoteSuccessPage() {
  const me = useMe().data!;
  const logout = useLogout();
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  if (!me.hasVoted || !me.vote) return <Navigate to="/" replace />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12 sm:px-6">
      {/* Sengaja tidak menampilkan kandidat pilihan maupun hasil sementara. */}
      <div className="w-full max-w-[520px] animate-pop rounded-modal border border-line bg-white px-6 py-10 text-center sm:px-9 sm:py-11">
        <div className="mx-auto flex size-[92px] animate-ring items-center justify-center rounded-full border-2 border-success-line bg-success-bg">
          <span className="flex size-[58px] items-center justify-center rounded-full bg-success text-white">
            <Check aria-hidden strokeWidth={3.5} className="size-[30px]" />
          </span>
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="mt-6 text-2xl font-extrabold outline-none sm:text-[28px]">
          Suara Anda Berhasil Direkam!
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-pretty text-ink-muted">
          Terima kasih telah berpartisipasi dalam Pemilihan Ketua OSIS SMAN 21 Kota Surabaya.
        </p>

        <dl className="mt-7 grid gap-2.5 rounded-xl border border-line bg-canvas p-4 text-left text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Waktu voting</dt>
            <dd className="text-right font-bold">{formatDateTime(me.vote.votedAt)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">ID suara</dt>
            <dd className="text-right font-mono font-bold">{me.vote.receiptCode}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Status</dt>
            <dd className="text-right font-bold text-success-ink">Tercatat &amp; terverifikasi</dd>
          </div>
        </dl>

        <p className="mt-[18px] text-[13px] leading-normal text-ink-muted">
          Pilihan Anda bersifat rahasia. Hasil pemilihan diumumkan panitia setelah masa pemungutan suara ditutup.
        </p>

        <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
          <button type="button" onClick={() => navigate('/')} className="btn btn-primary h-[46px] flex-1">
            Kembali ke Beranda
          </button>
          <button
            type="button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="btn btn-outline h-[46px] flex-1"
          >
            <LogOut aria-hidden className="size-4" /> {logout.isPending ? 'Keluar…' : 'Logout'}
          </button>
        </div>
      </div>
    </main>
  );
}
