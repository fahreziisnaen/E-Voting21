import { Logo } from '../../components/Logo';

export function Hero({ photoUrl }: { photoUrl: string | null }) {
  return (
    <section
      id="beranda"
      data-surface="navy"
      aria-labelledby="judul-pemilihan"
      className="relative scroll-mt-20 overflow-hidden bg-navy text-white"
    >
      {/* Slot foto gedung sekolah — ganti lewat Panel Panitia → Pengaturan Sistem. */}
      <div aria-hidden className="absolute inset-0 md:left-[52%]">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-stripes-navy" />
        )}
      </div>
      <div
        aria-hidden
        className="absolute inset-0 bg-navy/80 md:left-[52%] md:bg-transparent md:bg-[linear-gradient(90deg,#0F1F38_0%,rgba(15,31,56,0.55)_38%,rgba(15,31,56,0.25)_100%)]"
      />
      {!photoUrl && (
        <span
          aria-hidden
          className="absolute top-[48%] left-[74%] hidden -translate-x-1/2 -translate-y-1/2 rounded-md border border-dashed border-white/35 px-3.5 py-2 font-mono text-xs tracking-[0.1em] text-white/60 md:block"
        >
          foto gedung sekolah
        </span>
      )}
      <div aria-hidden className="absolute -top-10 -left-[60px] size-[150px] rotate-[38deg] bg-crimson opacity-90 sm:size-[200px]" />
      <div aria-hidden className="absolute top-[92px] -left-[130px] h-[36px] w-[200px] rotate-[38deg] bg-gold sm:top-[120px] sm:h-[46px] sm:w-[240px]" />

      <div className="relative mx-auto flex max-w-[1380px] items-center gap-5 px-4 py-9 sm:gap-9 sm:px-7 sm:py-11">
        <Logo
          className="h-[96px] drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)] sm:h-[136px] lg:h-[172px]"
        />
        <div aria-hidden className="w-[3px] self-stretch bg-gold" />
        <div className="min-w-0 animate-fade-up">
          <h1 id="judul-pemilihan">
            <span className="block text-[13px] font-bold tracking-[0.14em] text-on-navy-bright uppercase sm:text-lg lg:text-[22px]">
              Pemilihan Ketua OSIS
            </span>
            <span className="mt-1 block text-[40px] leading-[0.98] font-extrabold tracking-[-0.02em] text-gold sm:text-[52px] lg:text-[62px]">
              SMAN 21
            </span>
            <span className="mt-0.5 block text-[21px] leading-[1.05] font-extrabold tracking-[0.02em] sm:text-[28px] lg:text-[34px]">
              KOTA SURABAYA
            </span>
          </h1>
          <p className="mt-4 inline-block border-b-[3px] border-gold pb-2 text-sm font-semibold text-gold-pale italic sm:mt-[18px] sm:text-[17px] lg:text-[19px]">
            Suaramu Menentukan Masa Depan Sekolah
          </p>
        </div>
      </div>
    </section>
  );
}
