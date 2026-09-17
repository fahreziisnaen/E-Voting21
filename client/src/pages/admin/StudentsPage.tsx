import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Download,
  FileSpreadsheet,
  FileUp,
  KeyRound,
  LoaderCircle,
  Pencil,
  Plus,
  Trash,
} from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { AdminPageHeader, ErrorNotice, Pagination, Panel, selectClass } from '../../features/admin/AdminUi';
import { ClassSelect, GRADE_FILTER_OPTIONS, type GradeFilter } from '../../features/admin/ClassSelect';
import { useClasses, useDebouncedValue, useStudents, type StudentFilters } from '../../hooks/admin';
import { api, errorMessage, fieldErrors } from '../../lib/api';
import { cn } from '../../lib/cn';
import {
  downloadText,
  parseStudentRows,
  randomAccessCode,
  readSpreadsheet,
  STUDENT_CSV_TEMPLATE,
  toCsv,
  type StudentImportRow,
} from '../../lib/csv';
import { formatNumber, wibDateKey } from '../../lib/format';
import { detectGradeLevel, gradeLabel } from '../../lib/grade';
import type { ImportResult, Student } from '../../types';

const IMPORT_BATCH = 500;

function invalidateStudents(queryClient: ReturnType<typeof useQueryClient>) {
  for (const key of ['students', 'classes', 'stats', 'results']) {
    void queryClient.invalidateQueries({ queryKey: ['admin', key] });
  }
}

function StudentFormModal({ student, open, onClose }: { student: Student | null; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const classes = useClasses();
  const [form, setForm] = useState({ nis: '', name: '', classId: '' as number | '', password: '' });
  const [lastKey, setLastKey] = useState<string | null>(null);

  const key = open ? String(student?.id ?? 'baru') : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (key) setForm({ nis: student?.nis ?? '', name: student?.name ?? '', classId: student?.classId ?? '', password: '' });
  }

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, classId: form.classId === '' ? undefined : form.classId, password: form.password || undefined };
      return student ? api(`/admin/students/${student.id}`, { method: 'PUT', body }) : api('/admin/students', { method: 'POST', body });
    },
    onSuccess: () => {
      invalidateStudents(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'candidates'] });
      void queryClient.invalidateQueries({ queryKey: ['candidates'] });
      toast(student ? 'Data siswa diperbarui.' : 'Siswa ditambahkan.', 'success');
      onClose();
    },
  });
  const errors = fieldErrors(save.error);

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  const input = (name: 'nis' | 'name', label: string) => (
    <div>
      <label htmlFor={`siswa-${name}`} className="field-label">
        {label}
      </label>
      <input
        id={`siswa-${name}`}
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `siswa-${name}-error` : undefined}
        autoComplete="off"
        className="field-input h-11 text-sm"
      />
      {errors[name] && (
        <p id={`siswa-${name}-error`} className="field-error">
          {errors[name]}
        </p>
      )}
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} dismissible={!save.isPending} labelledBy="form-siswa-judul" panelClassName="max-w-[480px]">
      <form onSubmit={submit} noValidate className="p-6 sm:p-7">
        <h2 id="form-siswa-judul" className="text-xl font-extrabold">
          {student ? 'Edit Data Siswa' : 'Tambah Siswa'}
        </h2>
        {student?.candidateNumber && (
          <p className="mt-2 text-[13px] text-ink-muted">
            Siswa ini kandidat No. {student.candidateNumber}; perubahan nama & kelas langsung tampil di halaman kandidat.
          </p>
        )}
        <div className="mt-5 grid gap-4">
          {input('nis', 'NIS')}
          {input('name', 'Nama lengkap')}
          <div>
            <label htmlFor="siswa-kelas" className="field-label">
              Kelas
            </label>
            <ClassSelect
              id="siswa-kelas"
              classes={classes.data}
              value={form.classId}
              onChange={(classId) => setForm({ ...form, classId })}
              placeholder="Pilih kelas"
              invalid={Boolean(errors.classId)}
              describedBy="siswa-kelas-hint"
              className="field-input h-11 text-sm"
            />
            <p id="siswa-kelas-hint" className={errors.classId ? 'field-error' : 'mt-1.5 text-xs text-ink-muted'}>
              {errors.classId ??
                (classes.data?.length === 0 ? (
                  <>
                    Belum ada kelas.{' '}
                    <Link to="/admin/kelas" className="font-bold text-royal">
                      Tambah kelas
                    </Link>{' '}
                    terlebih dahulu.
                  </>
                ) : (
                  'Kelas dikelola di menu Data Kelas.'
                ))}
            </p>
          </div>
          <div>
            <label htmlFor="siswa-password" className="field-label">
              {student ? 'Kode akses baru' : 'Kode akses'}
            </label>
            <div className="flex gap-2">
              <input
                id="siswa-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                aria-invalid={Boolean(errors.password)}
                aria-describedby="siswa-password-hint"
                autoComplete="new-password"
                className="field-input h-11 font-mono text-sm"
              />
              <button type="button" onClick={() => setForm({ ...form, password: randomAccessCode() })} className="btn btn-outline h-11 shrink-0 px-3 text-[13px]">
                Buat acak
              </button>
            </div>
            <p id="siswa-password-hint" className={errors.password ? 'field-error' : 'mt-1.5 text-xs text-ink-muted'}>
              {errors.password ??
                (student
                  ? 'Kosongkan jika tidak diubah. Mengganti kode akses akan mengeluarkan siswa dari semua perangkat.'
                  : 'Minimal 6 karakter. Catat dan bagikan ke siswa secara langsung.')}
            </p>
          </div>
        </div>
        {save.isError && !Object.keys(errors).length && (
          <div className="mt-4">
            <ErrorNotice message={errorMessage(save.error)} />
          </div>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={save.isPending} className="btn btn-outline h-11">
            Batal
          </button>
          <button type="submit" disabled={save.isPending} className="btn btn-primary h-11 sm:min-w-36">
            {save.isPending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {save.isPending ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

type ImportStage =
  | { step: 'pick'; error?: string }
  | { step: 'preview'; fileName: string; rows: StudentImportRow[]; errors: string[] }
  | { step: 'done'; rows: StudentImportRow[]; result: ImportResult; downloaded: boolean };

function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const classes = useClasses();
  const [stage, setStage] = useState<ImportStage>({ step: 'pick' });
  const [createClasses, setCreateClasses] = useState(true);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState(0);

  const importMutation = useMutation({
    mutationFn: async (rows: StudentImportRow[]) => {
      const total: ImportResult = { received: 0, created: 0, skipped: 0, createdNis: [], createdClasses: [] };
      setProgress(0);
      // Per 500 baris agar setiap permintaan selesai cepat (hash kode akses memakan waktu).
      for (let i = 0; i < rows.length; i += IMPORT_BATCH) {
        const batch = rows.slice(i, i + IMPORT_BATCH);
        const result = await api<ImportResult>('/admin/students/import', {
          method: 'POST',
          body: {
            students: batch.map(({ nis, name, className, password }) => ({ nis, name, className, password })),
            createMissingClasses: createClasses,
          },
        });
        total.received += result.received;
        total.created += result.created;
        total.skipped += result.skipped;
        total.createdNis.push(...result.createdNis);
        total.createdClasses.push(...result.createdClasses);
        setProgress(i + batch.length);
      }
      return total;
    },
    onSuccess: (result, rows) => {
      invalidateStudents(queryClient);
      setStage({ step: 'done', rows, result, downloaded: false });
    },
    // Batch yang sudah tersimpan tidak hilang; ulangi impor untuk sisanya (NIS yang sudah ada dilewati).
    onError: () => invalidateStudents(queryClient),
  });

  const mustDownload = stage.step === 'done' && stage.result.created > 0 && !stage.downloaded;

  function close() {
    setStage({ step: 'pick' });
    setCreateClasses(true);
    importMutation.reset();
    onClose();
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setReading(true);
    try {
      const table = await readSpreadsheet(file);
      setStage({ step: 'preview', fileName: file.name, ...parseStudentRows(table) });
    } catch (err) {
      setStage({ step: 'pick', error: err instanceof Error && err.message.includes('.xls') ? err.message : 'Berkas tidak dapat dibaca. Pastikan formatnya .xlsx atau .csv.' });
    } finally {
      setReading(false);
    }
  }

  function downloadCodes() {
    if (stage.step !== 'done') return;
    const created = new Set(stage.result.createdNis.map((nis) => nis.toLowerCase()));
    const rows = stage.rows
      .filter((row) => created.has(row.nis.toLowerCase()))
      .sort((a, b) => a.className.localeCompare(b.className, 'id') || a.name.localeCompare(b.name, 'id'))
      .map((row) => [row.nis, row.name, row.className, row.password]);
    downloadText(`kode-akses-siswa-${wibDateKey(new Date())}.csv`, toCsv([['NIS', 'Nama', 'Kelas', 'Kode Akses'], ...rows]));
    setStage({ ...stage, downloaded: true });
  }

  const knownClasses = new Set((classes.data ?? []).map((c) => c.name.toLowerCase()));
  const newClasses =
    stage.step === 'preview'
      ? [...new Map(stage.rows.filter((r) => !knownClasses.has(r.className.toLowerCase())).map((r) => [r.className.toLowerCase(), r.className])).values()]
      : [];
  const generatedCount = stage.step === 'preview' ? stage.rows.filter((r) => r.generatedCode).length : 0;
  const blockedByClasses = newClasses.length > 0 && !createClasses;

  return (
    <Modal
      open={open}
      onClose={close}
      dismissible={!importMutation.isPending && !reading && !mustDownload}
      labelledBy="impor-judul"
      panelClassName="max-w-[680px] p-6 sm:p-7"
    >
      <h2 id="impor-judul" className="text-xl font-extrabold">
        Impor Data Siswa
      </h2>

      {stage.step === 'pick' && (
        <>
          <p className="mt-2 text-sm leading-normal text-ink-body">
            Unggah berkas <strong>Excel (.xlsx)</strong> atau <strong>CSV</strong> dengan kolom <code className="font-mono text-[13px]">nis</code>,{' '}
            <code className="font-mono text-[13px]">nama</code>, <code className="font-mono text-[13px]">kelas</code>, dan (opsional){' '}
            <code className="font-mono text-[13px]">kode_akses</code>.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] leading-normal text-ink-muted">
            <li>Kode akses yang kosong dibuat otomatis dan dapat diunduh setelah impor.</li>
            <li>Kelas yang belum ada dapat dibuat otomatis; tingkat (X/XI/XII) dikenali dari nama kelas.</li>
            <li>NIS yang sudah terdaftar dilewati. Di Excel, format kolom NIS sebagai <em>Teks</em> agar angka 0 di depan tidak hilang.</li>
          </ul>
          <button
            type="button"
            onClick={() => downloadText('template-data-siswa.csv', STUDENT_CSV_TEMPLATE)}
            className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-royal hover:text-navy-hover"
          >
            <Download aria-hidden className="size-3.5" /> Unduh template
          </button>

          <label
            htmlFor="impor-berkas"
            className="mt-5 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-line-strong bg-canvas px-4 py-8 text-center transition-colors hover:border-royal has-[:focus-visible]:border-royal"
          >
            {reading ? <LoaderCircle aria-hidden className="size-7 animate-spin text-royal" /> : <FileSpreadsheet aria-hidden className="size-7 text-royal" />}
            <span className="text-sm font-bold">{reading ? 'Membaca berkas…' : 'Pilih berkas .xlsx atau .csv'}</span>
            <input id="impor-berkas" type="file" accept=".xlsx,.csv,text/csv" onChange={(e) => void onFile(e)} className="sr-only" disabled={reading} />
          </label>
          {stage.error && (
            <div className="mt-4">
              <ErrorNotice message={stage.error} />
            </div>
          )}
          <div className="mt-6 flex justify-end">
            <button type="button" onClick={close} className="btn btn-outline h-11">
              Batal
            </button>
          </div>
        </>
      )}

      {stage.step === 'preview' && (
        <>
          <p className="mt-1 text-[13px] text-ink-muted">{stage.fileName}</p>
          <dl className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              { label: 'Siap diimpor', value: stage.rows.length, tone: 'text-success-ink' },
              { label: 'Baris bermasalah', value: stage.errors.length, tone: stage.errors.length ? 'text-danger-ink' : '' },
              { label: 'Kelas baru', value: newClasses.length, tone: newClasses.length ? 'text-warning-ink' : '' },
              { label: 'Kode akses otomatis', value: generatedCount, tone: '' },
            ].map((item) => (
              <div key={item.label} className="rounded-control border border-line bg-canvas px-3 py-2.5">
                <dt className="text-[11px] font-bold tracking-[0.04em] text-ink-muted uppercase">{item.label}</dt>
                <dd className={cn('mt-0.5 text-xl font-extrabold', item.tone)}>{formatNumber(item.value)}</dd>
              </div>
            ))}
          </dl>

          {stage.errors.length > 0 && (
            <details className="mt-3 rounded-control border border-danger-line bg-danger-bg px-3.5 py-2.5 text-[13px] text-danger-ink">
              <summary className="cursor-pointer font-semibold">
                {formatNumber(stage.errors.length)} baris bermasalah tidak akan diimpor
              </summary>
              <ul className="mt-2 max-h-28 list-disc overflow-y-auto pl-5">
                {stage.errors.slice(0, 100).map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </details>
          )}

          {newClasses.length > 0 && (
            <div className="mt-3 rounded-control border border-warning-line bg-warning-bg px-3.5 py-3 text-[13px] text-warning-ink">
              <p className="font-semibold">Kelas belum terdaftar:</p>
              <p className="mt-1 leading-relaxed">
                {newClasses.map((name) => `${name} (${gradeLabel(detectGradeLevel(name))})`).join(', ')}
              </p>
              <label className="mt-2 flex items-center gap-2 font-bold text-ink">
                <input type="checkbox" checked={createClasses} onChange={(e) => setCreateClasses(e.target.checked)} className="size-4 accent-royal" />
                Buat kelas yang belum ada secara otomatis
              </label>
            </div>
          )}

          {stage.rows.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-control border border-line">
              <table className="w-full min-w-[520px] text-left text-[13px]">
                <caption className="sr-only">Pratinjau data siswa</caption>
                <thead className="bg-canvas text-[11px] tracking-[0.06em] text-ink-muted uppercase">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-extrabold">NIS</th>
                    <th scope="col" className="px-3 py-2 font-extrabold">Nama</th>
                    <th scope="col" className="px-3 py-2 font-extrabold">Kelas</th>
                    <th scope="col" className="px-3 py-2 font-extrabold">Kode akses</th>
                  </tr>
                </thead>
                <tbody>
                  {stage.rows.slice(0, 6).map((row) => (
                    <tr key={row.nis} className="border-t border-line-soft">
                      <td className="px-3 py-2 font-mono">{row.nis}</td>
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2">
                        {row.className}
                        {!knownClasses.has(row.className.toLowerCase()) && (
                          <span className="ml-1.5 rounded-full bg-warning-bg px-1.5 py-0.5 text-[10px] font-bold text-warning-ink">baru</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-ink-muted">{row.generatedCode ? 'dibuat otomatis' : 'dari berkas'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-line-soft px-3 py-2 text-xs text-ink-muted">
                {stage.rows.length > 6 && `… dan ${formatNumber(stage.rows.length - 6)} baris lainnya. `}
                NIS yang sudah terdaftar akan dilewati saat impor.
              </p>
            </div>
          )}

          {importMutation.isError && (
            <div className="mt-4">
              <ErrorNotice message={errorMessage(importMutation.error)} />
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setStage({ step: 'pick' })} disabled={importMutation.isPending} className="btn btn-outline h-11">
              Pilih berkas lain
            </button>
            <button
              type="button"
              onClick={() => importMutation.mutate(stage.rows)}
              disabled={!stage.rows.length || importMutation.isPending || blockedByClasses}
              className="btn btn-primary h-11"
            >
              {importMutation.isPending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
              {importMutation.isPending
                ? `Mengimpor… ${formatNumber(progress)}/${formatNumber(stage.rows.length)}`
                : `Impor ${formatNumber(stage.rows.length)} siswa`}
            </button>
          </div>
          {blockedByClasses && (
            <p className="mt-2 text-right text-[13px] text-warning-ink">
              Centang “Buat kelas…” atau tambahkan kelasnya di Data Kelas terlebih dahulu.
            </p>
          )}
        </>
      )}

      {stage.step === 'done' && (
        <>
          <p className="mt-3 flex items-center gap-2 text-sm font-bold text-success-ink" role="status">
            <CircleCheck aria-hidden className="size-5" /> Impor selesai
          </p>
          <ul className="mt-2 space-y-1 text-sm text-ink-body">
            <li>{formatNumber(stage.result.created)} siswa ditambahkan</li>
            <li>{formatNumber(stage.result.skipped)} dilewati (NIS sudah terdaftar)</li>
            {stage.result.createdClasses.length > 0 && (
              <li>
                {formatNumber(stage.result.createdClasses.length)} kelas baru: {stage.result.createdClasses.join(', ')}
              </li>
            )}
          </ul>
          {stage.result.created > 0 && (
            <div className="mt-4 rounded-card border border-line bg-canvas p-4">
              <p className="flex items-start gap-2 text-[13px] leading-normal text-ink-body">
                <KeyRound aria-hidden className="mt-0.5 size-4 shrink-0 text-royal" />
                <span>
                  Unduh daftar kode akses sekarang untuk dibagikan ke siswa. Kode akses tidak disimpan dalam bentuk aslinya, jadi{' '}
                  <strong>tidak dapat ditampilkan lagi</strong> setelah jendela ini ditutup.
                </span>
              </p>
              <button type="button" onClick={downloadCodes} className="btn btn-primary mt-3 h-10">
                <Download aria-hidden className="size-4" /> Unduh kode akses (CSV)
              </button>
              {stage.downloaded && <p className="mt-2 text-[13px] font-semibold text-success-ink">Berkas sudah diunduh.</p>}
            </div>
          )}
          <div className="mt-6 flex justify-end">
            <button type="button" onClick={close} className={cn('btn h-11', mustDownload ? 'text-danger-ink hover:bg-danger-bg' : 'btn-outline')}>
              {mustDownload ? 'Tutup tanpa mengunduh' : 'Tutup'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

export default function StudentsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const classes = useClasses();
  const [searchParams] = useSearchParams();
  const initialClassId = Number(searchParams.get('classId'));
  const [filters, setFilters] = useState<StudentFilters>({
    page: 1,
    voted: 'all',
    classId: Number.isInteger(initialClassId) && initialClassId > 0 ? initialClassId : '',
    gradeLevel: '',
  });
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim());
  const students = useStudents({ ...filters, q });

  const [editing, setEditing] = useState<Student | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleting, setDeleting] = useState<Student | null>(null);

  const remove = useMutation({
    mutationFn: (id: number) => api(`/admin/students/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidateStudents(queryClient);
      toast('Data siswa dihapus.', 'success');
      setDeleting(null);
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const update = (patch: Partial<StudentFilters>) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));

  return (
    <>
      <AdminPageHeader
        title="Data Siswa"
        description="Daftar pemilih. Status memilih ditampilkan, pilihan kandidat tetap rahasia."
        actions={
          <>
            <button type="button" onClick={() => setImportOpen(true)} className="btn btn-outline h-10">
              <FileUp aria-hidden className="size-4" /> Impor Siswa
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="btn btn-primary h-10"
            >
              <Plus aria-hidden className="size-4" /> Tambah Siswa
            </button>
          </>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1 sm:max-w-xs">
          <label htmlFor="cari-siswa" className="field-label">
            Cari NIS atau nama
          </label>
          <input
            id="cari-siswa"
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              update({});
            }}
            className="field-input h-10 text-sm"
          />
        </div>
        <div>
          <label htmlFor="filter-tingkat" className="field-label">
            Tingkat
          </label>
          <select
            id="filter-tingkat"
            value={filters.gradeLevel}
            onChange={(e) => update({ gradeLevel: e.target.value as GradeFilter, classId: '' })}
            className={selectClass}
          >
            {GRADE_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-kelas" className="field-label">
            Kelas
          </label>
          <ClassSelect
            id="filter-kelas"
            classes={classes.data}
            value={filters.classId ?? ''}
            onChange={(classId) => update({ classId })}
            placeholder="Semua kelas"
            gradeFilter={filters.gradeLevel}
            className={selectClass}
          />
        </div>
        <div>
          <label htmlFor="filter-status" className="field-label">
            Status voting
          </label>
          <select
            id="filter-status"
            value={filters.voted}
            onChange={(e) => update({ voted: e.target.value as StudentFilters['voted'] })}
            className={selectClass}
          >
            <option value="all">Semua</option>
            <option value="yes">Sudah voting</option>
            <option value="no">Belum voting</option>
          </select>
        </div>
      </div>

      <Panel className={cn('transition-opacity', students.isPlaceholderData && 'opacity-60')}>
        {students.isError ? (
          <ErrorNotice message={errorMessage(students.error)} onRetry={() => void students.refetch()} />
        ) : !students.data ? (
          <div aria-hidden className="h-72 animate-pulse rounded-card bg-line-soft" />
        ) : students.data.students.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">Tidak ada siswa yang cocok dengan filter.</p>
        ) : (
          <>
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <caption className="sr-only">Daftar siswa</caption>
                <thead>
                  <tr className="border-b border-line-soft text-[11px] tracking-[0.06em] text-ink-muted uppercase">
                    <th scope="col" className="pb-2.5 font-extrabold">NIS</th>
                    <th scope="col" className="pb-2.5 font-extrabold">Nama</th>
                    <th scope="col" className="pb-2.5 font-extrabold">Kelas</th>
                    <th scope="col" className="pb-2.5 font-extrabold">Status voting</th>
                    <th scope="col" className="pb-2.5 text-right font-extrabold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {students.data.students.map((student) => (
                    <tr key={student.id} className="border-b border-canvas last:border-0">
                      <td className="py-3 pr-3 font-mono text-[13px]">{student.nis}</td>
                      <td className="py-3 pr-3 font-semibold">
                        {student.name}
                        {student.candidateNumber !== null && (
                          <span className="ml-2 rounded-full bg-royal-soft px-2 py-0.5 text-[11px] font-bold text-royal">
                            Kandidat No. {student.candidateNumber}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-ink-body">{student.className ?? '—'}</td>
                      <td className="py-3 pr-3">
                        {student.hasVoted ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-1 text-xs font-bold text-success-ink">
                            <CircleCheck aria-hidden className="size-3.5" /> Sudah
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-bg px-2.5 py-1 text-xs font-bold text-warning-ink">
                            <CircleDashed aria-hidden className="size-3.5" /> Belum
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(student);
                            setFormOpen(true);
                          }}
                          className="btn h-8 px-2.5 text-[13px] text-royal hover:bg-royal-soft"
                        >
                          <Pencil aria-hidden className="size-3.5" /> Edit<span className="sr-only"> {student.name}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(student)}
                          disabled={student.hasVoted || student.candidateNumber !== null}
                          title={
                            student.hasVoted
                              ? 'Siswa yang sudah memilih tidak dapat dihapus'
                              : student.candidateNumber !== null
                                ? 'Siswa yang menjadi kandidat tidak dapat dihapus'
                                : undefined
                          }
                          className="btn h-8 px-2.5 text-[13px] text-ink-muted hover:bg-danger-bg hover:text-danger-ink"
                        >
                          <Trash aria-hidden className="size-3.5" /> Hapus<span className="sr-only"> {student.name}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={filters.page}
              pageSize={students.data.pageSize}
              total={students.data.total}
              onPageChange={(page) => update({ page })}
            />
          </>
        )}
      </Panel>

      <StudentFormModal student={editing} open={formOpen} onClose={() => setFormOpen(false)} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        dismissible={!remove.isPending}
        role="alertdialog"
        labelledBy="hapus-siswa-judul"
        panelClassName="max-w-[420px] p-6"
      >
        <h2 id="hapus-siswa-judul" className="flex items-center gap-2 text-lg font-extrabold">
          <CircleAlert aria-hidden className="size-5 text-danger" /> Hapus data siswa?
        </h2>
        <p className="mt-2 text-sm text-ink-body">
          {deleting?.name} (NIS {deleting?.nis}) akan dihapus dan tidak dapat lagi masuk untuk memilih.
        </p>
        <div className="mt-5 flex justify-end gap-2.5">
          <button type="button" onClick={() => setDeleting(null)} disabled={remove.isPending} className="btn btn-outline h-10">
            Batal
          </button>
          <button type="button" onClick={() => deleting && remove.mutate(deleting.id)} disabled={remove.isPending} className="btn btn-danger h-10">
            {remove.isPending ? 'Menghapus…' : 'Hapus'}
          </button>
        </div>
      </Modal>
    </>
  );
}
