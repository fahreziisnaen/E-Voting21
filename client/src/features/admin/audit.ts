import type { AuditLogEntry, AuditStatus } from '../../types';

const REJECTION_REASON: Record<string, string> = {
  already_voted: 'Percobaan voting kedua di kategori yang sama ditolak',
  outside_schedule: 'Voting di luar jadwal ditolak',
  invalid_candidate: 'Voting ke kandidat tidak valid ditolak',
  not_eligible: 'Voting di kategori yang bukan haknya ditolak',
};

const ACTION_LABELS: Record<string, string> = {
  'auth.logout': 'Logout',
  'vote.cast': 'Vote tersimpan (transaksi commit)',
  'election.updated': 'Jadwal voting diperbarui',
  'election.hero_photo_updated': 'Foto gedung sekolah diperbarui',
  'category.created': 'Kategori ditambahkan',
  'category.updated': 'Kategori diperbarui',
  'category.deleted': 'Kategori dihapus',
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
  'teacher.created': 'Guru ditambahkan',
  'teacher.updated': 'Data guru diperbarui',
  'teacher.deleted': 'Guru dihapus',
  'teacher.access_code_reset': 'Kode akses guru direset',
  'teacher.imported': 'Impor data guru',
  'results.published': 'Hasil pemilihan diumumkan',
  'results.unpublished': 'Pengumuman hasil ditarik kembali',
  'results.exported': 'Hasil voting diekspor (CSV)',
  'admin.password_changed': 'Kata sandi panitia diubah',
  'backup.created': 'Cadangan data diunduh',
  'backup.restored': 'Data dipulihkan dari cadangan',
  'system.factory_reset': 'Reset pabrik — seluruh data dihapus',
};

/** Pilihan filter di halaman Audit Log. */
export const AUDIT_ACTION_OPTIONS = [
  { value: 'auth.login', label: 'Login' },
  { value: 'vote.cast', label: 'Vote tersimpan' },
  { value: 'vote.rejected', label: 'Vote ditolak' },
  { value: 'election.updated', label: 'Perubahan jadwal' },
  { value: 'results.published', label: 'Hasil diumumkan' },
  { value: 'results.unpublished', label: 'Pengumuman ditarik' },
  { value: 'category.created', label: 'Kategori ditambahkan' },
  { value: 'category.updated', label: 'Kategori diperbarui' },
  { value: 'category.deleted', label: 'Kategori dihapus' },
  { value: 'candidate.created', label: 'Kandidat ditambahkan' },
  { value: 'candidate.updated', label: 'Kandidat diperbarui' },
  { value: 'candidate.deleted', label: 'Kandidat dihapus' },
  { value: 'student.imported', label: 'Impor siswa' },
  { value: 'teacher.imported', label: 'Impor guru' },
  { value: 'class.updated', label: 'Perubahan kelas' },
  { value: 'student.access_code_reset', label: 'Reset kode akses siswa' },
  { value: 'teacher.access_code_reset', label: 'Reset kode akses guru' },
  { value: 'results.exported', label: 'Ekspor hasil' },
  { value: 'backup.created', label: 'Unduh cadangan' },
  { value: 'backup.restored', label: 'Pemulihan cadangan' },
  { value: 'system.factory_reset', label: 'Reset pabrik' },
];

export const AUDIT_STATUS: Record<AuditStatus, { label: string; className: string }> = {
  success: { label: 'Sukses', className: 'text-success-ink' },
  rejected: { label: 'Ditolak', className: 'text-warning-ink' },
  failed: { label: 'Gagal', className: 'text-danger-ink' },
};

const ROLE_LOGIN: Record<string, string> = { admin: 'Login panitia', teacher: 'Login guru', student: 'Login siswa' };

export function describeAudit(log: AuditLogEntry): { title: string; detail?: string } {
  const meta = log.metadata ?? {};
  const text = (key: string) => (typeof meta[key] === 'string' || typeof meta[key] === 'number' ? String(meta[key]) : undefined);

  switch (log.action) {
    case 'auth.login':
      if (log.status !== 'success') return { title: 'Login gagal', detail: 'NIS/username atau kode akses salah' };
      return { title: ROLE_LOGIN[text('role') ?? ''] ?? 'Login pemilih' };
    case 'vote.rejected': {
      const title = REJECTION_REASON[text('reason') ?? ''] ?? 'Voting ditolak';
      return { title, detail: text('category') };
    }
    case 'vote.cast':
      return { title: ACTION_LABELS[log.action]!, detail: [text('category'), text('receiptCode')].filter(Boolean).join(' · ') || undefined };
    case 'student.imported':
      return {
        title: ACTION_LABELS[log.action]!,
        detail: `${text('created') ?? 0} dibuat · ${text('skipped') ?? 0} dilewati · ${text('createdClasses') ?? 0} kelas baru`,
      };
    case 'teacher.imported':
      return {
        title: ACTION_LABELS[log.action]!,
        detail: `${text('created') ?? 0} dibuat · ${text('skipped') ?? 0} dilewati`,
      };
    default: {
      const identity = text('voterNis') ?? text('studentNis');
      const detail = text('name') ?? (identity ? `ID ${identity}` : undefined);
      return { title: ACTION_LABELS[log.action] ?? log.action, detail };
    }
  }
}
