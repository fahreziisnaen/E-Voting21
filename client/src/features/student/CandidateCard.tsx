import type { MouseEvent } from 'react';
import { CandidateBadge, CandidatePhoto } from '../../components/CandidateVisuals';
import { candidateAccent } from '../../lib/candidates';
import { cn } from '../../lib/cn';
import type { Candidate } from '../../types';

interface CandidateCardProps {
  candidate: Candidate;
  onDetail: (candidate: Candidate, trigger: HTMLElement) => void;
  onPick: (candidate: Candidate, trigger: HTMLElement) => void;
}

export function CandidateCard({ candidate, onDetail, onPick }: CandidateCardProps) {
  const accent = candidateAccent(candidate.candidateNumber);
  const titleId = `kandidat-${candidate.id}-nama`;

  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-col overflow-hidden rounded-card border border-line bg-white transition duration-200 ease-out hover:-translate-y-[3px] hover:shadow-card-hover motion-reduce:hover:translate-y-0"
    >
      <div className="relative aspect-[4/5]">
        <CandidatePhoto photoUrl={candidate.photoUrl} name={candidate.name} />
        <CandidateBadge number={candidate.candidateNumber} className="absolute top-3 left-3" />
      </div>
      <div className="flex flex-1 flex-col gap-2.5 px-4 pt-4 pb-[18px]">
        <div className="text-center">
          <h3 id={titleId} className="text-[17px] font-extrabold">
            {candidate.name}
          </h3>
          <p className="mt-1 text-[13px] text-ink-muted">{candidate.className}</p>
        </div>
        <div className="border-t border-line-soft pt-2.5">
          <p className={cn('eyebrow mb-1.5', accent.label)}>Visi</p>
          <p className="line-clamp-3 text-[13px] leading-normal text-pretty text-ink-body">“{candidate.vision}”</p>
        </div>
        <div className="mt-auto flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={(e: MouseEvent<HTMLButtonElement>) => onDetail(candidate, e.currentTarget)}
            className="h-10 rounded-button border border-line-strong bg-white text-[13px] font-bold text-ink transition-colors hover:border-royal hover:text-royal"
          >
            Lihat Detail<span className="sr-only"> {candidate.name}</span>
          </button>
          <button
            type="button"
            onClick={(e: MouseEvent<HTMLButtonElement>) => onPick(candidate, e.currentTarget)}
            className={cn('h-[42px] rounded-button text-[13px] font-bold transition-[filter]', accent.button)}
          >
            Pilih Kandidat<span className="sr-only"> nomor {candidate.candidateNumber}, {candidate.name}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

export function CandidateCardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col overflow-hidden rounded-card border border-line bg-white">
      <div className="aspect-[4/5] animate-pulse bg-line-soft" />
      <div className="flex flex-col gap-3 px-4 pt-4 pb-[18px]">
        <div className="mx-auto h-4 w-2/3 animate-pulse rounded bg-line-soft" />
        <div className="mx-auto h-3 w-1/3 animate-pulse rounded bg-line-soft" />
        <div className="mt-2 h-3 w-full animate-pulse rounded bg-line-soft" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-line-soft" />
        <div className="mt-3 h-10 animate-pulse rounded-button bg-line-soft" />
        <div className="h-[42px] animate-pulse rounded-button bg-line-soft" />
      </div>
    </div>
  );
}
