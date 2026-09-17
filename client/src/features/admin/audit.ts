import type { AuditLogEntry, AuditStatus } from '../../types';

const REJECTION_REASON: Record<string, string> = {
  already_voted: 'Percobaan voting kedua ditolak',
  outside_schedule: 'Voting di luar jadwal ditolak',
  invalid_candidate: 'Voting ke kandidat tidak valid ditolak',
};

const ACTION_LABELS: Record<string, string> = {
  'auth.logout': 'Logout',
  'vote.cast': 'Vote tersimpan (transaksi commit)',
  'election.updated': 'Jadwal voting diperbarui',
  'election.hero_photo_updated': 'Foto gedung sekolah diperbarui',
  'candidate.created': 'Kandidat ditambahkan',
  'candidate.updated': 'Data kandidat diperbarui',
  'candidate.deleted': 'Kandidat dihapus',
  'candidate.photo_updated': 'Foto kandidat diperbarui',
  'class.created': 'Kelas ditambahkan',
  'class.updated': 'Data kelas diperbarui',
  'class.deleted': 'Kelas dihapus',
  'student.created': 'Siswa ditambahkan',
  'student.updated': 'Data siswa diperbarui',
  'student.deleted': 'Siswa dihapus',
  'student.access_code_reset': 'Kode akses siswa direset',
  'student.imported': 'Impor data siswa',
  'results.exported': 'Hasil voting diekspor (CSV)',
  'admin.password_changed': 'Kata sandi panitia diubah',
};

/** Pilihan filter di halaman Audit Log. */
export const AUDIT_ACTION_OPTIONS = [
  { value: 'auth.login', label: 'Login' },
  { value: 'vote.cast', label: 'Vote tersimpan' },
  { value: 'vote.rejected', label: 'Vote ditolak' },
  { value: 'election.updated', label: 'Perubahan jadwal' },
  { value: 'candidate.created', label: 'Kandidat ditambahkan' },
  { value: 'candidate.updated', label: 'Kandidat diperbarui' },
  { value: 'candidate.deleted', label: 'Kandidat dihapus' },
  { value: 'student.imported', label: 'Impor siswa' },
  { value: 'class.updated', label: 'Perubahan kelas' },
  { value: 'student.access_code_reset', label: 'Reset kode akses' },
  { value: 'results.exported', label: 'Ekspor hasil' },
];

export const AUDIT_STATUS: Record<AuditStatus, { label: string; className: string }> = {
  success: { label: 'Sukses', className: 'text-success-ink' },
  rejected: { label: 'Ditolak', className: 'text-warning-ink' },
  failed: { label: 'Gagal', className: 'text-danger-ink' },
};

export function describeAudit(log: AuditLogEntry): { title: string; detail?: string } {
  const meta = log.metadata ?? {};
  const text = (key: string) => (typeof meta[key] === 'string' || typeof meta[key] === 'number' ? String(meta[key]) : undefined);

  switch (log.action) {
    case 'auth.login':
      if (log.status !== 'success') return { title: 'Login gagal', detail: 'NIS/username atau kode akses salah' };
      return { title: meta.role === 'admin' ? 'Login panitia' : 'Login siswa' };
    case 'vote.rejected':
      return { title: REJECTION_REASON[text('reason') ?? ''] ?? 'Voting ditolak' };
    case 'vote.cast':
      return { title: ACTION_LABELS[log.action]!, detail: text('receiptCode') };
    case 'student.imported':
      return {
        title: ACTION_LABELS[log.action]!,
        detail: `${text('created') ?? 0} dibuat · ${text('skipped') ?? 0} dilewati · ${text('createdClasses') ?? 0} kelas baru`,
      };
    default: {
      const detail = text('name') ?? (text('studentNis') ? `NIS ${text('studentNis')}` : undefined);
      return { title: ACTION_LABELS[log.action] ?? log.action, detail };
    }
  }
}
