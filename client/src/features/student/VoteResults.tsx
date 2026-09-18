import { CandidateBadge } from '../../components/CandidateVisuals';
import { candidateAccent } from '../../lib/candidates';
import { cn } from '../../lib/cn';
import { formatNumber, formatPercent } from '../../lib/format';
import { personMeta } from '../../lib/voting';
import type { CandidateResult } from '../../types';

/**
 * Perolehan suara tiap kandidat. Warna batang mengikuti nomor urut kandidat (identitasnya),
 * dan setiap nilai selalu ditulis sebagai angka sehingga tidak bergantung pada warna.
 */
export function VoteBars({ candidates, winnerIds }: { candidates: CandidateResult[]; winnerIds: number[] }) {
  return (
    <ol className="flex flex-col gap-3.5">
      {candidates.map((candidate) => {
        const isWinner = winnerIds.includes(candidate.id);
        const accent = candidateAccent(candidate.candidateNumber);
        return (
          <li key={candidate.id} className="flex items-center gap-3">
            <CandidateBadge number={candidate.candidateNumber} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className={cn('truncate text-sm', isWinner ? 'font-extrabold text-ink' : 'font-bold text-ink-body')}>
                  {candidate.name}
                </span>
                <span className="text-xs text-ink-muted">{personMeta(candidate)}</span>
                <span className="ml-auto text-[13px] font-bold whitespace-nowrap text-ink tabular-nums">
                  {formatNumber(candidate.votes)} suara · {formatPercent(candidate.percentage)}
                </span>
              </div>
              <div aria-hidden className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-line-soft">
                <div
                  className={cn('h-full rounded-full', accent.bar)}
                  style={{ width: `${Math.max(candidate.percentage, candidate.votes > 0 ? 1 : 0)}%` }}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
