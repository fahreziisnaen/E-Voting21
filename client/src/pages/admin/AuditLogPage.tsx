import { useState } from 'react';
import { AdminPageHeader, ErrorNotice, Pagination, Panel, selectClass } from '../../features/admin/AdminUi';
import { AUDIT_ACTION_OPTIONS } from '../../features/admin/audit';
import { AuditLogTable } from '../../features/admin/AuditLogTable';
import { useAuditLogs, useDebouncedValue } from '../../hooks/admin';
import { errorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';
import type { AuditStatus } from '../../types';

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [status, setStatus] = useState<AuditStatus | ''>('');
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim());
  const logs = useAuditLogs({ page, pageSize: 25, action, status, q });

  return (
    <>
      <AdminPageHeader title="Audit Log" description="Jejak seluruh aktivitas penting: login, suara, penolakan, dan perubahan data." />

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="audit-aksi" className="field-label">
            Aksi
          </label>
          <select
            id="audit-aksi"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className={selectClass}
          >
            <option value="">Semua aksi</option>
            {AUDIT_ACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="audit-status" className="field-label">
            Status
          </label>
          <select
            id="audit-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as AuditStatus | '');
              setPage(1);
            }}
            className={selectClass}
          >
            <option value="">Semua status</option>
            <option value="success">Sukses</option>
            <option value="rejected">Ditolak</option>
            <option value="failed">Gagal</option>
          </select>
        </div>
        <div className="min-w-[200px] flex-1 sm:max-w-xs">
          <label htmlFor="audit-aktor" className="field-label">
            Cari aktor (NIS / username)
          </label>
          <input
            id="audit-aktor"
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="field-input h-10 text-sm"
          />
        </div>
      </div>

      <Panel className={cn('transition-opacity', logs.isPlaceholderData && 'opacity-60')}>
        {logs.isError ? (
          <ErrorNotice message={errorMessage(logs.error)} onRetry={() => void logs.refetch()} />
        ) : logs.data ? (
          <>
            <AuditLogTable logs={logs.data.logs} showDate caption="Daftar audit log" />
            <Pagination page={page} pageSize={logs.data.pageSize} total={logs.data.total} onPageChange={setPage} />
          </>
        ) : (
          <div aria-hidden className="h-64 animate-pulse rounded-card bg-line-soft" />
        )}
      </Panel>
    </>
  );
}
