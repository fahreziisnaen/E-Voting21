import { LogOut, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Logo } from '../../components/Logo';
import { cn } from '../../lib/cn';
import { initials } from '../../lib/format';
import type { SessionUser } from '../../types';

const LINKS = [
  { id: 'beranda', label: 'Beranda' },
  { id: 'kandidat', label: 'Kandidat' },
  { id: 'tatacara', label: 'Tata Cara Voting' },
];
const SECTION_IDS = LINKS.map((link) => link.id);

/** Scroll-spy: section terakhir yang bagian atasnya sudah melewati bawah navbar. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  // Setelah link diklik, pertahankan pilihan selama smooth scroll berjalan.
  const lockedUntil = useRef(0);

  const select = (id: string) => {
    lockedUntil.current = Date.now() + 900;
    setActive(id);
  };

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (Date.now() < lockedUntil.current) return;
      let current = ids[0];
      for (const id of ids) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= 120) current = id;
      }
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [ids]);
  return [active, select] as const;
}

interface StudentNavbarProps {
  user: SessionUser;
  onLogout: () => void;
  loggingOut: boolean;
}

export function StudentNavbar({ user, onLogout, loggingOut }: StudentNavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, selectSection] = useActiveSection(SECTION_IDS);
  const meta =
    user.role === 'admin'
      ? 'Panitia · Mode pratinjau'
      : [user.className, `NIS ${user.nis}`].filter(Boolean).join(' · ');

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white">
      <a
        href="#kandidat"
        className="sr-only rounded-control bg-navy px-4 py-2 text-sm font-bold text-white focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Lewati ke daftar kandidat
      </a>
      <div className="mx-auto flex h-[68px] max-w-[1380px] items-center gap-4 px-4 sm:px-7 lg:h-[76px] lg:gap-9">
        <a href="#beranda" className="flex items-center gap-3 rounded-lg" onClick={() => setMenuOpen(false)}>
          <Logo className="h-10 lg:h-12" />
          <span className="leading-[1.15]">
            <span className="block text-[17px] font-extrabold tracking-[-0.01em] text-navy lg:text-[19px]">SMAN 21</span>
            <span className="block text-[11px] font-semibold tracking-[0.1em] text-ink-muted uppercase">Kota Surabaya</span>
          </span>
        </a>

        <nav aria-label="Navigasi utama" className="ml-5 hidden items-center gap-1.5 lg:flex">
          {LINKS.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              onClick={() => selectSection(link.id)}
              aria-current={active === link.id ? 'location' : undefined}
              className={cn(
                'rounded-lg border-b-[3px] px-3.5 py-2.5 text-sm transition-colors',
                active === link.id
                  ? 'border-gold font-bold text-navy'
                  : 'border-transparent font-semibold text-ink-muted hover:text-navy',
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-3 rounded-full border border-line bg-white py-[7px] pr-3.5 pl-2 lg:flex">
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
              <a
                key={link.id}
                href={`#${link.id}`}
                onClick={() => {
                  selectSection(link.id);
                  setMenuOpen(false);
                }}
                aria-current={active === link.id ? 'location' : undefined}
                className={cn(
                  'border-l-[3px] px-3 py-3 text-[15px]',
                  active === link.id ? 'border-gold font-bold text-navy' : 'border-transparent font-semibold text-ink-muted',
                )}
              >
                {link.label}
              </a>
            ))}
          </nav>
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
        </div>
      )}
    </header>
  );
}
