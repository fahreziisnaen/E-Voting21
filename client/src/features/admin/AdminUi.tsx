import { ChevronLeft, ChevronRight, CircleAlert, CircleCheck, CircleSlash, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useElection } from '../../hooks/queries';
import { cn } from '../../lib/cn';
import { PHASE_INFO, TONE_BADGE } from '../../lib/election';
import { formatDateRange, formatNumber } from '../../lib/format';

export function AdminPageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  const election = useElection().data;
  const phase = election ? PHASE_INFO[election.phase] : null;
  const PhaseIcon: LucideIcon = phase?.tone === 'success' ? CircleCheck : phase?.tone === 'warning' ? CircleAlert : CircleSlash;

  return (
    <header className="flex flex-wrap items-end gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold sm:text-[26px]">{title}</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          {description ??
            (election ? `${election.electionName} · ${formatDateRange(election.startDate, election.endDate)}` : ' ')}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2.5 sm:ml-auto">
        {actions}
        {phase && (
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-extrabold tracking-[0.06em] uppercase',
              TONE_BADGE[phase.tone],
            )}
          >
            <PhaseIcon aria-hidden className="size-3.5" />
            {phase.banner}
          </span>
        )}
      </div>
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  titleId,
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  titleId?: string;
}) {
  return (
    <section aria-labelledby={title ? titleId : undefined} className={cn('rounded-panel border border-line bg-white p-5 sm:p-[22px]', className)}>
      {(title || actions) && (
        <div className="mb-[18px] flex flex-wrap items-start gap-3">
          <div className="min-w-0">
            {title && (
              <h2 id={titleId} className="text-[17px] font-extrabold">
                {title}
              </h2>
            )}
            {description && <p className="mt-1.5 text-[13px] leading-normal text-ink-muted">{description}</p>}
          </div>
          {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <nav aria-label="Navigasi halaman" className="mt-4 flex flex-wrap items-center gap-3 text-[13px] text-ink-muted">
      <span>
        Menampilkan {formatNumber(from)}–{formatNumber(to)} dari {formatNumber(total)}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="btn btn-outline h-9 px-3"
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft aria-hidden className="size-4" />
        </button>
        <span className="font-semibold text-ink">
          {page} / {pages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          className="btn btn-outline h-9 px-3"
          aria-label="Halaman berikutnya"
        >
          <ChevronRight aria-hidden className="size-4" />
        </button>
      </div>
    </nav>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-card border border-danger-line bg-danger-bg px-4 py-3 text-sm font-semibold text-danger-ink">
      <CircleAlert aria-hidden className="size-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-outline h-8 px-3 text-xs">
          Coba lagi
        </button>
      )}
    </div>
  );
}

export const selectClass =
  'h-10 rounded-control border border-line-strong bg-white px-3 text-sm text-ink outline-none focus:border-royal focus:ring-3 focus:ring-royal/15';
