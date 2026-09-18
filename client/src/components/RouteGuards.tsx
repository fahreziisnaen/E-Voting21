import { LoaderCircle, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useMe } from '../hooks/queries';
import type { Role } from '../types';

export function PageLoader({ label = 'Memuat…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status">
      <LoaderCircle aria-hidden className="size-7 animate-spin text-royal" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

function SessionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-sm text-center" role="alert">
        <h1 className="text-xl font-extrabold">Tidak dapat memuat sesi</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Server sedang tidak dapat dihubungi. Periksa koneksi internet Anda lalu coba lagi.
        </p>
        <button type="button" onClick={onRetry} className="btn btn-primary mt-5 h-11">
          <RefreshCw aria-hidden className="size-4" /> Coba lagi
        </button>
      </div>
    </div>
  );
}

/** Halaman yang butuh login dengan peran tertentu. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) return <PageLoader />;
  if (me.isError) return <SessionError onRetry={() => void me.refetch()} />;
  if (!me.data) {
    const loginPath = roles.includes('admin') ? '/admin/login' : '/login';
    return <Navigate to={loginPath} replace state={{ from: location.pathname }} />;
  }
  if (!roles.includes(me.data.user.role)) {
    return <Navigate to={me.data.user.role === 'admin' ? '/admin' : '/'} replace />;
  }
  return children;
}

/** State yang dibawa ke halaman login, mis. dari tombol "Pilih Kandidat" saat belum masuk. */
export interface LoginRedirectState {
  from?: string;
  pickCandidateId?: number;
  pickCandidateName?: string;
}

/**
 * Halaman login: pengguna yang sudah masuk (termasuk tepat setelah login berhasil) diarahkan
 * kembali ke halaman asal. Niat memilih kandidat diteruskan agar modal konfirmasi langsung terbuka.
 */
export function GuestOnly({ children }: { children: ReactNode }) {
  const me = useMe();
  const location = useLocation();
  if (me.isPending) return <PageLoader />;
  if (me.data) {
    const state = location.state as LoginRedirectState | null;
    if (me.data.user.role === 'admin') {
      return <Navigate to={state?.from?.startsWith('/admin') ? state.from : '/admin'} replace />;
    }
    const from = state?.from && !state.from.startsWith('/admin') && !state.from.startsWith('/login') ? state.from : '/';
    return <Navigate to={from} replace state={state?.pickCandidateId ? { pickCandidateId: state.pickCandidateId } : null} />;
  }
  return children;
}
