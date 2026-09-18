/** Warna aksen per nomor urut: 1 merah, 2 emas, 3 biru, 4 navy (berulang untuk nomor > 4). */
const ACCENTS = [
  {
    badge: 'bg-crimson text-white shadow-[0_4px_12px_rgba(227,30,36,0.35)]',
    button: 'bg-crimson text-white hover:brightness-[0.93]',
    label: 'text-crimson',
    bar: 'bg-crimson',
    border: 'border-crimson',
    color: '#E31E24',
  },
  {
    badge: 'bg-gold text-ink shadow-[0_4px_12px_rgba(244,194,13,0.4)]',
    button: 'bg-gold text-ink hover:brightness-95',
    label: 'text-gold-ink',
    bar: 'bg-gold',
    border: 'border-gold',
    color: '#F4C20D',
  },
  {
    badge: 'bg-royal text-white shadow-[0_4px_12px_rgba(11,92,171,0.35)]',
    button: 'bg-royal text-white hover:brightness-[0.93]',
    label: 'text-royal',
    bar: 'bg-royal',
    border: 'border-royal',
    color: '#0B5CAB',
  },
  {
    badge: 'bg-navy text-white shadow-[0_4px_12px_rgba(15,31,56,0.35)]',
    button: 'bg-navy text-white hover:brightness-125',
    label: 'text-navy',
    bar: 'bg-navy',
    border: 'border-navy',
    color: '#0F1F38',
  },
] as const;

export type CandidateAccent = (typeof ACCENTS)[number];

export function candidateAccent(candidateNumber: number): CandidateAccent {
  const index = (((candidateNumber - 1) % ACCENTS.length) + ACCENTS.length) % ACCENTS.length;
  return ACCENTS[index]!;
}
