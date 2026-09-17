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
    const loginPath = roles.includes('student') ? '/login' : '/admin/login';
    return <Navigate to={loginPath} replace state={{ from: location.pathname }} />;
  }
  if (!roles.includes(me.data.user.role)) {
    return <Navigate to={me.data.user.role === 'admin' ? '/admin' : '/'} replace />;
  }
  return children;
}

/** Halaman login: pengguna yang sudah masuk langsung diarahkan. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const me = useMe();
  if (me.isPending) return <PageLoader />;
  if (me.data) return <Navigate to={me.data.user.role === 'admin' ? '/admin' : '/'} replace />;
  return children;
}
