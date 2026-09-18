import { CircleAlert, CircleCheck, CircleX } from 'lucide-react';
import { cn } from '../../lib/cn';
import { formatClock, formatLongDate } from '../../lib/format';
import type { AuditLogEntry } from '../../types';
import { TableSwipeHint } from './AdminUi';
import { AUDIT_STATUS, describeAudit } from './audit';

const STATUS_ICON = { success: CircleCheck, rejected: CircleAlert, failed: CircleX };

export function AuditLogTable({ logs, showDate = false, caption }: { logs: AuditLogEntry[]; showDate?: boolean; caption: string }) {
  if (logs.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-muted">Belum ada aktivitas yang tercatat.</p>;
  }
  return (
    <>
      <TableSwipeHint />
      <div className="-mx-1 table-scroll px-1">
        <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-line-soft text-[11px] tracking-[0.06em] text-ink-muted uppercase">
              <th scope="col" className="w-[150px] pb-2.5 font-extrabold">
                Waktu
              </th>
              <th scope="col" className="pb-2.5 font-extrabold">
                Aksi
              </th>
              <th scope="col" className="w-[140px] pb-2.5 font-extrabold">
                Aktor
              </th>
              <th scope="col" className="w-[120px] pb-2.5 font-extrabold">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const { title, detail } = describeAudit(log);
              const status = AUDIT_STATUS[log.status];
              const Icon = STATUS_ICON[log.status];
              return (
                <tr key={log.id} className="border-b border-canvas last:border-0">
                  <td className="py-[13px] pr-3 align-top font-mono text-ink-muted">
                    {formatClock(log.timestamp)}
                    {showDate && <span className="block font-sans text-[11px]">{formatLongDate(log.timestamp)}</span>}
                  </td>
                  <td className="py-[13px] pr-3 align-top">
                    {title}
                    {detail && <span className="block text-xs text-ink-muted">{detail}</span>}
                  </td>
                  <td className="py-[13px] pr-3 align-top break-all text-ink-muted">
                    {log.actor ? (/^\d+$/.test(log.actor) ? `NIS ${log.actor}` : log.actor) : '—'}
                  </td>
                  <td className={cn('py-[13px] align-top font-bold', status.className)}>
                    <span className="inline-flex items-center gap-1.5">
                      <Icon aria-hidden className="size-3.5" />
                      {status.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
