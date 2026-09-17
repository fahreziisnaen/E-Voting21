import { Logo } from '../../components/Logo';

export function SiteFooter() {
  return (
    <footer data-surface="navy" className="relative mt-3 overflow-hidden bg-navy text-on-navy">
      <div aria-hidden className="absolute -right-10 -bottom-[60px] size-[180px] rotate-[38deg] bg-crimson opacity-80" />
      <div aria-hidden className="absolute right-[90px] -bottom-[70px] h-10 w-[180px] rotate-[38deg] bg-gold" />
      <div className="relative mx-auto flex max-w-[1380px] flex-col items-center gap-4 px-4 py-[26px] text-center sm:px-7 lg:flex-row lg:gap-6 lg:text-left">
        <div className="flex items-center gap-3">
          <Logo height={42} />
          <div className="leading-[1.15] text-white">
            <p className="text-base font-extrabold">SMAN 21</p>
            <p className="text-[11px] font-semibold tracking-[0.1em] text-on-navy-muted uppercase">Kota Surabaya</p>
          </div>
        </div>
        <p className="flex flex-wrap justify-center gap-x-[18px] gap-y-1 text-xs font-semibold tracking-[0.08em] uppercase lg:mx-auto">
          <span>Berkarakter</span>
          <span aria-hidden>·</span>
          <span>Berprestasi</span>
          <span aria-hidden>·</span>
          <span>Berwawasan Global</span>
        </p>
        <p className="text-xs text-on-navy-muted lg:pr-24">© {new Date().getFullYear()} SMAN 21 Kota Surabaya</p>
      </div>
    </footer>
  );
}
