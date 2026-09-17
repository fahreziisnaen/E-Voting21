import logoUrl from '../assets/logo-sman21.png';
import { cn } from '../lib/cn';

// Ukuran asli logo 584×740. Lebar selalu `auto` agar proporsi tidak pernah berubah.
const WIDTH = 584;
const HEIGHT = 740;

/** `height` dalam px; atau kosongkan dan atur tinggi lewat className (mis. responsif). */
export function Logo({ height, className, decorative = false }: { height?: number; className?: string; decorative?: boolean }) {
  return (
    <img
      src={logoUrl}
      alt={decorative ? '' : 'Logo SMAN 21 Kota Surabaya'}
      width={WIDTH}
      height={HEIGHT}
      className={cn('w-auto shrink-0', className)}
      style={height ? { height } : undefined}
    />
  );
}
