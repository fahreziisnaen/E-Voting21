import { Eye, EyeOff, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Logo } from '../components/Logo';
import { useElection, useLogin } from '../hooks/queries';
import { errorMessage } from '../lib/api';
import { wibYear } from '../lib/format';

const COPY = {
  student: {
    title: 'Masuk sebagai siswa',
    subtitle: 'Gunakan NIS dan kode akses yang dibagikan panitia OSIS.',
    idLabel: 'NIS / Username',
    secretLabel: 'Kode Akses',
    switchLabel: 'Masuk sebagai panitia',
    switchTo: '/admin/login',
  },
  admin: {
    title: 'Masuk sebagai panitia',
    subtitle: 'Gunakan username dan kata sandi panitia OSIS.',
    idLabel: 'Username',
    secretLabel: 'Kata Sandi',
    switchLabel: 'Masuk sebagai siswa',
    switchTo: '/login',
  },
} as const;

export function LoginPage({ variant }: { variant: 'student' | 'admin' }) {
  const copy = COPY[variant];
  const login = useLogin();
  const election = useElection();
  const navigate = useNavigate();
  const location = useLocation();

  const [nis, setNis] = useState('');
  const [password, setPassword] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [touched, setTouched] = useState(false);

  const nisError = touched && !nis.trim() ? `${copy.idLabel} wajib diisi.` : undefined;
  const passwordError = touched && !password ? `${copy.secretLabel} wajib diisi.` : undefined;
  const year = election.data ? wibYear(election.data.startDate) : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!nis.trim() || !password || login.isPending) return;
    try {
      const { user } = await login.mutateAsync({ nis: nis.trim(), password });
      const from = (location.state as { from?: string } | null)?.from;
      if (user.role === 'admin') navigate(from?.startsWith('/admin') ? from : '/admin', { replace: true });
      else navigate(from && !from.startsWith('/admin') ? from : '/', { replace: true });
    } catch {
      setPassword('');
    }
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_1fr]">
      <div
        data-surface="navy"
        className="relative flex flex-col justify-between overflow-hidden bg-navy px-6 pt-8 pb-7 text-white sm:px-10 lg:px-14 lg:pt-14 lg:pb-11"
      >
        <div aria-hidden className="absolute -top-[60px] -left-[80px] size-[140px] rotate-[38deg] bg-crimson opacity-85 lg:-top-[70px] lg:-left-[90px] lg:size-[260px]" />
        <div aria-hidden className="absolute -top-1 -left-[110px] h-8 w-[170px] rotate-[38deg] bg-gold lg:top-10 lg:-left-[140px] lg:h-[60px] lg:w-[260px]" />
        <div aria-hidden className="absolute -right-[120px] -bottom-[120px] hidden size-[380px] rounded-full border border-gold/25 lg:block" />

        <div className="relative flex items-center gap-3.5 pl-10 lg:pl-0">
          <Logo className="h-12 lg:h-[58px]" />
          <div className="leading-[1.1]">
            <p className="text-lg font-extrabold tracking-[0.01em] lg:text-xl">SMAN 21</p>
            <p className="text-xs font-medium tracking-[0.08em] text-on-navy-soft uppercase">Kota Surabaya</p>
          </div>
        </div>

        <div className="relative my-8 max-w-[460px] lg:my-12">
          <p className="inline-block rounded-full border border-gold/40 px-3 py-1.5 text-xs font-bold tracking-[0.12em] text-gold uppercase">
            Pemilihan Ketua OSIS{year ? ` ${year}` : ''}
          </p>
          <h1 className="mt-5 text-[36px] leading-[1.05] font-extrabold tracking-[-0.02em] lg:mt-[22px] lg:text-[46px]">
            E-Voting OSIS
          </h1>
          <p className="mt-3.5 text-[15px] leading-relaxed text-pretty text-on-navy lg:text-[17px]">
            Pemilihan Ketua OSIS SMAN 21 Kota Surabaya. Satu siswa, satu suara, tercatat aman.
          </p>
          <div aria-hidden className="mt-6 h-[3px] w-[72px] bg-gold lg:mt-[30px]" />
          <p className="mt-5 text-[15px] font-semibold italic lg:mt-[22px]">“Suaramu Menentukan Masa Depan Sekolah”</p>
        </div>

        <p className="relative hidden gap-7 text-xs font-semibold tracking-[0.06em] text-on-navy-muted uppercase sm:flex">
          <span>Berkarakter</span>
          <span>Berprestasi</span>
          <span>Berwawasan Global</span>
        </p>
      </div>

      <main className="flex items-center justify-center px-5 py-10 sm:px-10 lg:py-12">
        <div className="w-full max-w-[396px] animate-fade-up">
          <h2 className="text-2xl font-extrabold sm:text-[28px]">{copy.title}</h2>
          <p className="mt-2.5 mb-[30px] text-[15px] leading-normal text-ink-muted">{copy.subtitle}</p>

          <form noValidate onSubmit={handleSubmit}>
            <label htmlFor="nis" className="field-label">
              {copy.idLabel}
            </label>
            <input
              id="nis"
              name="nis"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={nis}
              onChange={(e) => setNis(e.target.value)}
              aria-invalid={Boolean(nisError)}
              aria-describedby={nisError ? 'nis-error' : undefined}
              className="field-input"
            />
            {nisError && (
              <p id="nis-error" className="field-error">
                {nisError}
              </p>
            )}

            <label htmlFor="password" className="field-label mt-5">
              {copy.secretLabel}
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showSecret ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(passwordError)}
                aria-describedby={passwordError ? 'password-error' : undefined}
                className="field-input pr-12"
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                aria-label={showSecret ? `Sembunyikan ${copy.secretLabel.toLowerCase()}` : `Tampilkan ${copy.secretLabel.toLowerCase()}`}
                aria-pressed={showSecret}
                className="absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted hover:text-ink"
              >
                {showSecret ? <EyeOff aria-hidden className="size-[18px]" /> : <Eye aria-hidden className="size-[18px]" />}
              </button>
            </div>
            {passwordError && (
              <p id="password-error" className="field-error">
                {passwordError}
              </p>
            )}

            {login.isError && (
              <p
                role="alert"
                className="mt-5 flex items-start gap-2 rounded-control border border-danger-line bg-danger-bg px-3.5 py-3 text-[13px] leading-normal font-semibold text-danger-ink"
              >
                <TriangleAlert aria-hidden className="mt-px size-4 shrink-0" />
                {errorMessage(login.error)}
              </p>
            )}

            <button
              type="submit"
              disabled={login.isPending}
              className="btn btn-primary mt-[26px] h-[50px] w-full text-[15px] tracking-[0.01em] hover:-translate-y-px active:translate-y-0 disabled:hover:translate-y-0"
            >
              {login.isPending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
              {login.isPending ? 'Memproses…' : 'Masuk'}
            </button>
          </form>

          <div className="mt-[22px] flex gap-3 rounded-control border border-line bg-canvas px-4 py-3.5">
            <span aria-hidden className="flex size-5 shrink-0 items-center justify-center rounded-full bg-royal text-[13px] font-extrabold text-white">
              i
            </span>
            <p className="text-[13px] leading-normal text-ink-body">
              Setiap siswa hanya dapat memberikan <strong className="text-ink">satu suara</strong>. Pilihan yang sudah
              dikonfirmasi tidak dapat diubah.
            </p>
          </div>

          <div className="mt-[26px] flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-muted">
            <span>Butuh bantuan? Hubungi panitia.</span>
            <Link to={copy.switchTo} className="font-bold text-royal hover:text-navy-hover">
              {copy.switchLabel}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
