import {
  Activity,
  CalendarClock,
  ChartColumn,
  DatabaseBackup,
  Contact,
  Eye,
  GraduationCap,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  School,
  ScrollText,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Logo } from '../../components/Logo';
import { PageLoader } from '../../components/RouteGuards';
import { useLogout, useMe } from '../../hooks/queries';
import { cn } from '../../lib/cn';

const NAV = [
  { to: '/admin', end: true, label: 'Dashboard Overview', icon: LayoutDashboard },
  { to: '/admin/monitoring', label: 'Monitoring Voting', icon: Activity },
  { to: '/admin/kategori', label: 'Data Kategori', icon: Layers },
  { to: '/admin/kandidat', label: 'Data Kandidat', icon: Contact },
  { to: '/admin/siswa', label: 'Data Siswa', icon: Users },
  { to: '/admin/guru', label: 'Data Guru', icon: GraduationCap },
  { to: '/admin/kelas', label: 'Data Kelas', icon: School },
  { to: '/admin/jadwal', label: 'Jadwal Voting', icon: CalendarClock },
  { to: '/admin/hasil', label: 'Hasil Voting', icon: ChartColumn },
  { to: '/admin/audit-log', label: 'Audit Log', icon: ScrollText },
  { to: '/admin/pengaturan', label: 'Pengaturan Sistem', icon: Settings },
  { to: '/admin/cadangan', label: 'Cadangan & Reset', icon: DatabaseBackup },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const me = useMe().data;
  const logout = useLogout();
  return (
    <div data-surface="navy" className="flex h-full flex-col gap-[26px] overflow-y-auto bg-navy px-[18px] py-6 text-on-navy">
      <div className="flex items-center gap-[11px]">
        <Logo height={42} />
        <div className="leading-[1.15] text-white">
          <p className="text-[15px] font-extrabold">Panel Panitia</p>
          <p className="text-[11px] font-semibold tracking-[0.08em] text-on-navy-muted uppercase">SMAN 21</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup menu"
            className="ml-auto flex size-9 items-center justify-center rounded-button text-on-navy hover:bg-navy-soft hover:text-white"
          >
            <X aria-hidden className="size-5" />
          </button>
        )}
      </div>

      <nav aria-label="Menu panel panitia" className="flex flex-col gap-1">
        {NAV.map(({ to, end, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-button px-[13px] py-[11px] text-sm transition-colors',
                isActive ? 'bg-navy-active font-bold text-white' : 'font-semibold hover:bg-navy-soft hover:text-white',
              )
            }
          >
            <Icon aria-hidden className="size-[17px] shrink-0 opacity-80" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-2">
        {me && (
          <p className="px-1 text-xs text-on-navy-muted">
            Masuk sebagai <span className="font-bold text-on-navy">{me.user.nis}</span>
          </p>
        )}
        <Link
          to="/"
          className="flex h-[42px] items-center justify-center gap-2 rounded-button border border-navy-line text-[13px] font-bold transition-colors hover:border-on-navy-muted hover:text-white"
        >
          <Eye aria-hidden className="size-4" /> Lihat tampilan pemilih
        </Link>
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="flex h-[42px] items-center justify-center gap-2 rounded-button border border-navy-line text-[13px] font-bold transition-colors hover:border-gold hover:text-gold"
        >
          <LogOut aria-hidden className="size-4" /> {logout.isPending ? 'Keluar…' : 'Keluar'}
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen lg:block">
        <SidebarContent />
      </aside>

      <header data-surface="navy" className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-navy px-4 text-white lg:hidden">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Buka menu panitia"
          aria-expanded={drawerOpen}
          className="flex size-10 items-center justify-center rounded-button hover:bg-navy-soft"
        >
          <Menu aria-hidden className="size-5" />
        </button>
        <Logo height={30} />
        <span className="text-[15px] font-extrabold">Panel Panitia</span>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 animate-veil bg-navy/55" onClick={() => setDrawerOpen(false)} aria-hidden />
          <div role="dialog" aria-modal="true" aria-label="Menu panitia" className="absolute inset-y-0 left-0 w-[272px] max-w-[85vw] animate-fade-up">
            <SidebarContent onClose={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <main className="min-w-0 px-4 pt-6 pb-10 sm:px-8 sm:pt-7">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-[22px]">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
