import { candidateAccent } from '../lib/candidates';
import { cn } from '../lib/cn';

const BADGE_SIZE = {
  md: 'size-10 text-lg',
  lg: 'size-[44px] text-[19px]',
  xl: 'size-[46px] text-xl',
  sm: 'size-8 text-sm',
} as const;

export function CandidateBadge({
  number,
  size = 'md',
  className,
}: {
  number: number;
  size?: keyof typeof BADGE_SIZE;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-extrabold',
        BADGE_SIZE[size],
        candidateAccent(number).badge,
        className,
      )}
      aria-label={`Nomor urut ${number}`}
    >
      {number}
    </span>
  );
}

/** Foto kandidat atau placeholder bergaris bila belum diunggah. */
export function CandidatePhoto({
  photoUrl,
  name,
  className,
}: {
  photoUrl: string | null;
  name: string;
  className?: string;
}) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={`Foto ${name}`}
        loading="lazy"
        decoding="async"
        className={cn('h-full w-full object-cover', className)}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={`Foto ${name} belum tersedia`}
      className={cn('flex h-full w-full items-center justify-center bg-stripes', className)}
    >
      <span className="font-mono text-[11px] tracking-[0.08em] text-[#8FA0B6]">foto kandidat</span>
    </div>
  );
}
