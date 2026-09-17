import { Link } from 'react-router';
import { Logo } from '../components/Logo';

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <Logo height={72} className="mx-auto" />
        <h1 className="mt-6 text-2xl font-extrabold">Halaman tidak ditemukan</h1>
        <p className="mt-2 text-sm text-ink-muted">Alamat yang Anda buka tidak tersedia.</p>
        <Link to="/" className="btn btn-primary mt-6 h-11">
          Kembali ke Beranda
        </Link>
      </div>
    </main>
  );
}
