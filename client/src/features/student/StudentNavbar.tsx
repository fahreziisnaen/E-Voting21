import { LogIn, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { Logo } from '../../components/Logo';
import type { LoginRedirectState } from '../../components/RouteGuards';
import { cn } from '../../lib/cn';
import { initials } from '../../lib/format';
import type { SessionUser } from '../../types';

const LINKS = [
  { to: '/', label: 'Beranda', end: true },
  { to: '/kandidat', label: 'Kandidat', end: false },
  { to: '/terpilih', label: 'Terpilih', end: false },
];

interface StudentNavbarProps {
  /** null untuk pengunjung yang belum masuk. */
  user: SessionUser | null;
  loading: boolean;
  onLogout: () => void;
  loggingOut: boolean;
}

export function StudentNavbar({ user, loading, onLogout, loggingOut }: StudentNavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const loginState: LoginRedirectState = { from: location.pathname + location.search };
  const meta =
    user?.role === 'admin'
      ? 'Panitia · Mode pratinjau'
      : user?.role === 'teacher'
        ? `Guru · ${user.nis}`
        : [user?.className, user && `NIS ${user.nis}`].filter(Boolean).join(' · ');
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white">
      <a
        href="#konten"
        className="sr-only rounded-control bg-navy px-4 py-2 text-sm font-bold text-white focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Lewati ke konten utama
      </a>
      <div className="mx-auto flex h-[68px] max-w-[1380px] items-center gap-4 px-4 sm:px-7 lg:h-[76px] lg:gap-9">
        <Link to="/" className="flex items-center gap-3 rounded-lg" onClick={closeMenu}>
          <Logo className="h-10 lg:h-12" />
          <span className="leading-[1.15]">
            <span className="block text-[17px] font-extrabold tracking-[-0.01em] text-navy lg:text-[19px]">SMAN 21</span>
            <span className="block text-[11px] font-semibold tracking-[0.1em] text-ink-muted uppercase">Kota Surabaya</span>
          </span>
        </Link>

        <nav aria-label="Navigasi utama" className="ml-5 hidden items-center gap-1.5 lg:flex">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  'rounded-lg border-b-[3px] px-3.5 py-2.5 text-sm transition-colors',
                  isActive ? 'border-gold font-bold text-navy' : 'border-transparent font-semibold text-ink-muted hover:text-navy',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto hidden lg:block">
          {loading ? (
            <div aria-hidden className="h-[50px] w-48 animate-pulse rounded-full bg-line-soft" />
          ) : user ? (
            <div className="flex items-center gap-3 rounded-full border border-line bg-white py-[7px] pr-3.5 pl-2">
              <span aria-hidden className="flex size-[34px] items-center justify-center rounded-full bg-navy text-[13px] font-extrabold text-white">
                {initials(user.name)}
              </span>
              <span className="leading-[1.2]">
                <span className="block text-[13px] font-bold">{user.name}</span>
                <span className="block text-[11px] text-ink-muted">{meta}</span>
              </span>
              <button
                type="button"
                onClick={onLogout}
                disabled={loggingOut}
                className="rounded-md p-1 text-[13px] font-bold text-ink-muted transition-colors hover:text-danger"
              >
                {loggingOut ? 'Keluar…' : 'Keluar'}
              </button>
            </div>
          ) : (
            <Link to="/login" state={loginState} className="btn btn-primary h-11 px-5">
              <LogIn aria-hidden className="size-4" /> Masuk untuk Memilih
            </Link>
          )}
        </div>

        <button
          type="button"
          className="ml-auto flex size-11 items-center justify-center rounded-control border border-line text-navy lg:hidden"
          aria-expanded={menuOpen}
          aria-controls="menu-seluler"
          aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
        </button>
      </div>

      {menuOpen && (
        <div id="menu-seluler" className="animate-fade-up border-t border-line bg-white px-4 pt-2 pb-4 sm:px-7 lg:hidden">
          <nav aria-label="Navigasi utama" className="flex flex-col">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={closeMenu}
                className={({ isActive }) =>
                  cn(
                    'border-l-[3px] px-3 py-3 text-[15px]',
                    isActive ? 'border-gold font-bold text-navy' : 'border-transparent font-semibold text-ink-muted',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          {user ? (
            <>
              <div className="mt-3 flex items-center gap-3 rounded-card border border-line p-3">
                <span aria-hidden className="flex size-[38px] items-center justify-center rounded-full bg-navy text-[13px] font-extrabold text-white">
                  {initials(user.name)}
                </span>
                <span className="min-w-0 flex-1 leading-[1.25]">
                  <span className="block truncate text-sm font-bold">{user.name}</span>
                  <span className="block truncate text-xs text-ink-muted">{meta}</span>
                </span>
              </div>
              <button type="button" onClick={onLogout} disabled={loggingOut} className="btn btn-outline mt-3 h-11 w-full">
                <LogOut aria-hidden className="size-4" /> {loggingOut ? 'Keluar…' : 'Keluar'}
              </button>
            </>
          ) : (
            !loading && (
              <Link to="/login" state={loginState} onClick={closeMenu} className="btn btn-primary mt-3 h-11 w-full">
                <LogIn aria-hidden className="size-4" /> Masuk untuk Memilih
              </Link>
            )
          )}
        </div>
      )}
    </header>
  );
}
