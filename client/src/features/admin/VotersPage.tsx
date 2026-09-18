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
  SquarePen,
  Trash,
  X,
} from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { useClasses, useDebouncedValue, useVoters, VOTER_ENDPOINT, type VoterFilters } from '../../hooks/admin';
import { api, errorMessage, fieldErrors } from '../../lib/api';
import { cn } from '../../lib/cn';
import {
  downloadText,
  parseVoterRows,
  randomAccessCode,
  readSpreadsheet,
  STUDENT_CSV_TEMPLATE,
  TEACHER_CSV_TEMPLATE,
  toCsv,
  type VoterImportRow,
} from '../../lib/csv';
import { formatNumber, wibDateKey } from '../../lib/format';
import { detectGradeLevel, gradeLabel } from '../../lib/grade';
import type { ImportResult, Voter, VoterRole } from '../../types';
import { AdminPageHeader, ErrorNotice, Pagination, Panel, selectClass, TableSwipeHint } from './AdminUi';
import { ClassSelect, GRADE_FILTER_OPTIONS, type GradeFilter } from './ClassSelect';

const IMPORT_BATCH = 500;

interface RoleCopy {
  /** Label identitas: NIS untuk siswa, username untuk guru. */
  id: string;
  /** Penjelasan singkat di bawah kolom identitas. */
  idHint: string;
  noun: string;
  nounPlural: string;
  title: string;
  description: string;
  template: { file: string; content: string };
  /** Kunci cache TanStack Query. */
  queryKey: string;
  withClass: boolean;
}

const COPY: Record<VoterRole, RoleCopy> = {
  student: {
    id: 'NIS',
    idHint: 'Dipakai siswa untuk masuk.',
    noun: 'siswa',
    nounPlural: 'siswa',
    title: 'Data Siswa',
    description: 'Daftar pemilih siswa. Status memilih ditampilkan, pilihan kandidat tetap rahasia.',
    template: {
      file: 'template-data-siswa.csv',
      content: STUDENT_CSV_TEMPLATE,
    },
    queryKey: 'students',
    withClass: true,
  },
  teacher: {
    id: 'Username',
    idHint: 'Username login buatan panitia, mis. guru.budi. Jangan memakai NIP karena bersifat rahasia.',
    noun: 'guru',
    nounPlural: 'guru',
    title: 'Data Guru',
    description: 'Daftar pemilih guru. Guru masuk dengan username buatan panitia — bukan NIP — dan kode akses.',
    template: { file: 'template-data-guru.csv', content: TEACHER_CSV_TEMPLATE },
    queryKey: 'teachers',
    withClass: false,
  },
};

function invalidateVoters(queryClient: ReturnType<typeof useQueryClient>, copy: RoleCopy) {
  for (const key of [copy.queryKey, 'classes', 'stats', 'results', 'candidates']) {
    void queryClient.invalidateQueries({ queryKey: ['admin', key] });
  }
}

function VoterFormModal({ role, voter, open, onClose }: { role: VoterRole; voter: Voter | null; open: boolean; onClose: () => void }) {
  const copy = COPY[role];
  const queryClient = useQueryClient();
  const toast = useToast();
  const classes = useClasses();
  const [form, setForm] = useState({
    nis: '',
    name: '',
    classId: '' as number | '',
    password: '',
  });
  const [lastKey, setLastKey] = useState<string | null>(null);

  const key = open ? String(voter?.id ?? 'baru') : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (key)
      setForm({
        nis: voter?.nis ?? '',
        name: voter?.name ?? '',
        classId: voter?.classId ?? '',
        password: '',
      });
  }

  const save = useMutation({
    mutationFn: () => {
      const body = {
        nis: form.nis,
        name: form.name,
        classId: copy.withClass ? (form.classId === '' ? undefined : form.classId) : null,
        password: form.password || undefined,
      };
      const base = VOTER_ENDPOINT[role];
      return voter ? api(`${base}/${voter.id}`, { method: 'PUT', body }) : api(base, { method: 'POST', body });
    },
    onSuccess: () => {
      invalidateVoters(queryClient, copy);
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast(voter ? `Data ${copy.noun} diperbarui.` : `Data ${copy.noun} ditambahkan.`, 'success');
      onClose();
    },
  });
  const errors = fieldErrors(save.error);

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  const input = (name: 'nis' | 'name', label: string, hint?: string) => (
    <div>
      <label htmlFor={`pemilih-${name}`} className="field-label">
        {label}
      </label>
      <input
        id={`pemilih-${name}`}
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={`pemilih-${name}-hint`}
        autoComplete="off"
        className="field-input h-11 text-sm"
      />
      {(errors[name] || hint) && (
        <p id={`pemilih-${name}-hint`} className={errors[name] ? 'field-error' : 'mt-1.5 text-xs text-ink-muted'}>
          {errors[name] ?? hint}
        </p>
      )}
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} dismissible={!save.isPending} labelledBy="form-pemilih-judul" panelClassName="max-w-[480px]">
      <form onSubmit={submit} noValidate className="p-6 sm:p-7">
        <h2 id="form-pemilih-judul" className="text-xl font-extrabold">
          {voter ? `Edit Data ${copy.title.replace('Data ', '')}` : `Tambah ${copy.title.replace('Data ', '')}`}
        </h2>
        {voter && voter.candidacies.length > 0 && (
          <p className="mt-2 text-[13px] text-ink-muted">
            Terdaftar sebagai kandidat di {voter.candidacies.map((c) => `${c.categoryName} (No. ${c.candidateNumber})`).join(', ')};
            perubahan nama {copy.withClass ? '& kelas ' : ''}langsung tampil di halaman kandidat.
          </p>
        )}
        <div className="mt-5 grid gap-4">
          {input('nis', copy.id, copy.idHint)}
          {input('name', 'Nama lengkap')}
          {copy.withClass && (
            <div>
              <label htmlFor="pemilih-kelas" className="field-label">
                Kelas
              </label>
              <ClassSelect
                id="pemilih-kelas"
                classes={classes.data}
                value={form.classId}
                onChange={(classId) => setForm({ ...form, classId })}
                placeholder="Pilih kelas"
                invalid={Boolean(errors.classId)}
                describedBy="pemilih-kelas-hint"
                className="field-input h-11 text-sm"
              />
              <p id="pemilih-kelas-hint" className={errors.classId ? 'field-error' : 'mt-1.5 text-xs text-ink-muted'}>
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
          )}
          <div>
            <label htmlFor="pemilih-password" className="field-label">
              {voter ? 'Kode akses baru' : 'Kode akses'}
            </label>
            <div className="flex gap-2">
              <input
                id="pemilih-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                aria-invalid={Boolean(errors.password)}
                aria-describedby="pemilih-password-hint"
                autoComplete="new-password"
                className="field-input h-11 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setForm({ ...form, password: randomAccessCode() })}
                className="btn btn-outline h-11 shrink-0 px-3 text-[13px]"
              >
                Buat acak
              </button>
            </div>
            <p id="pemilih-password-hint" className={errors.password ? 'field-error' : 'mt-1.5 text-xs text-ink-muted'}>
              {errors.password ??
                (voter
                  ? `Kosongkan jika tidak diubah. Mengganti kode akses akan mengeluarkan ${copy.noun} dari semua perangkat.`
                  : `Minimal 6 karakter. Catat dan bagikan ke ${copy.noun} secara langsung.`)}
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
  | {
      step: 'preview';
      fileName: string;
      rows: VoterImportRow[];
      errors: string[];
    }
  | {
      step: 'done';
      rows: VoterImportRow[];
      result: ImportResult;
      downloaded: boolean;
    };

function ImportModal({ role, open, onClose }: { role: VoterRole; open: boolean; onClose: () => void }) {
  const copy = COPY[role];
  const queryClient = useQueryClient();
  const classes = useClasses();
  const [stage, setStage] = useState<ImportStage>({ step: 'pick' });
  const [createClasses, setCreateClasses] = useState(true);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState(0);

  const importMutation = useMutation({
    mutationFn: async (rows: VoterImportRow[]) => {
      const total: ImportResult = {
        received: 0,
        created: 0,
        skipped: 0,
        createdNis: [],
        createdClasses: [],
      };
      setProgress(0);
      // Per 500 baris agar setiap permintaan selesai cepat (hash kode akses memakan waktu).
      for (let i = 0; i < rows.length; i += IMPORT_BATCH) {
        const batch = rows.slice(i, i + IMPORT_BATCH);
        const result = await api<ImportResult>(`${VOTER_ENDPOINT[role]}/import`, {
          method: 'POST',
          body: {
            rows: batch.map(({ nis, name, className, password }) =>
              copy.withClass ? { nis, name, className, password } : { nis, name, password },
            ),
            createMissingClasses: copy.withClass && createClasses,
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
      invalidateVoters(queryClient, copy);
      setStage({ step: 'done', rows, result, downloaded: false });
    },
    // Batch yang sudah tersimpan tidak hilang; ulangi impor untuk sisanya (identitas yang sudah ada dilewati).
    onError: () => invalidateVoters(queryClient, copy),
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
      setStage({
        step: 'preview',
        fileName: file.name,
        ...parseVoterRows(table, { withClass: copy.withClass }),
      });
    } catch (err) {
      setStage({
        step: 'pick',
        error:
          err instanceof Error && err.message.includes('.xls')
            ? err.message
            : 'Berkas tidak dapat dibaca. Pastikan formatnya .xlsx atau .csv.',
      });
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
      .map((row) => (copy.withClass ? [row.nis, row.name, row.className, row.password] : [row.nis, row.name, row.password]));
    const header = copy.withClass ? [copy.id, 'Nama', 'Kelas', 'Kode Akses'] : [copy.id, 'Nama', 'Kode Akses'];
    downloadText(`kode-akses-${copy.noun}-${wibDateKey(new Date())}.csv`, toCsv([header, ...rows]));
    setStage({ ...stage, downloaded: true });
  }

  const knownClasses = new Set((classes.data ?? []).map((c) => c.name.toLowerCase()));
  const newClasses =
    stage.step === 'preview' && copy.withClass
      ? [
          ...new Map(
            stage.rows.filter((r) => !knownClasses.has(r.className.toLowerCase())).map((r) => [r.className.toLowerCase(), r.className]),
          ).values(),
        ]
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
        Impor {copy.title.replace('Data ', 'Data ')}
      </h2>

      {stage.step === 'pick' && (
        <>
          <p className="mt-2 text-sm leading-normal text-ink-body">
            Unggah berkas <strong>Excel (.xlsx)</strong> atau <strong>CSV</strong> dengan kolom{' '}
            <code className="font-mono text-[13px]">{copy.id.toLowerCase()}</code>, <code className="font-mono text-[13px]">nama</code>,{' '}
            {copy.withClass && (
              <>
                <code className="font-mono text-[13px]">kelas</code>,{' '}
              </>
            )}
            dan (opsional) <code className="font-mono text-[13px]">kode_akses</code>.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] leading-normal text-ink-muted">
            <li>Kode akses yang kosong dibuat otomatis dan dapat diunduh setelah impor.</li>
            {copy.withClass && <li>Kelas yang belum ada dapat dibuat otomatis; tingkat (X/XI/XII) dikenali dari nama kelas.</li>}
            <li>
              {copy.id} yang sudah terdaftar dilewati.
              {copy.withClass ? (
                <>
                  {' '}
                  Di Excel, format kolom {copy.id} sebagai <em>Teks</em> agar angka 0 di depan tidak hilang.
                </>
              ) : (
                ' Username dibuat panitia (mis. guru.budi) — jangan memakai NIP.'
              )}
            </li>
          </ul>
          <button
            type="button"
            onClick={() => downloadText(copy.template.file, copy.template.content)}
            className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-royal hover:text-navy-hover"
          >
            <Download aria-hidden className="size-3.5" /> Unduh template
          </button>

          <label
            htmlFor="impor-berkas"
            className="mt-5 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-line-strong bg-canvas px-4 py-8 text-center transition-colors hover:border-royal has-[:focus-visible]:border-royal"
          >
            {reading ? (
              <LoaderCircle aria-hidden className="size-7 animate-spin text-royal" />
            ) : (
              <FileSpreadsheet aria-hidden className="size-7 text-royal" />
            )}
            <span className="text-sm font-bold">{reading ? 'Membaca berkas…' : 'Pilih berkas .xlsx atau .csv'}</span>
            <input
              id="impor-berkas"
              type="file"
              accept=".xlsx,.csv,text/csv"
              onChange={(e) => void onFile(e)}
              className="sr-only"
              disabled={reading}
            />
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
              {
                label: 'Siap diimpor',
                value: stage.rows.length,
                tone: 'text-success-ink',
              },
              {
                label: 'Baris bermasalah',
                value: stage.errors.length,
                tone: stage.errors.length ? 'text-danger-ink' : '',
              },
              ...(copy.withClass
                ? [
                    {
                      label: 'Kelas baru',
                      value: newClasses.length,
                      tone: newClasses.length ? 'text-warning-ink' : '',
                    },
                  ]
                : []),
              { label: 'Kode akses otomatis', value: generatedCount, tone: '' },
            ].map((item) => (
              <div key={item.label} className="rounded-control border border-line bg-canvas px-3 py-2.5">
                <dt className="text-[11px] font-bold tracking-[0.04em] text-ink-muted uppercase">{item.label}</dt>
                <dd className={cn('mt-0.5 text-xl font-extrabold', item.tone)}>{formatNumber(item.value)}</dd>
              </div>
            ))}
          </dl>

          {stage.errors.length > 0 && (
            <details
              open={stage.rows.length === 0}
              className="mt-3 rounded-control border border-danger-line bg-danger-bg px-3.5 py-2.5 text-[13px] text-danger-ink"
            >
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
                <input
                  type="checkbox"
                  checked={createClasses}
                  onChange={(e) => setCreateClasses(e.target.checked)}
                  className="size-4 accent-royal"
                />
                Buat kelas yang belum ada secara otomatis
              </label>
            </div>
          )}

          {stage.rows.length > 0 && (
            <div className="mt-4 table-scroll rounded-control border border-line">
              <table className="w-full min-w-[520px] text-left text-[13px]">
                <caption className="sr-only">Pratinjau data {copy.noun}</caption>
                <thead className="bg-canvas text-[11px] tracking-[0.06em] text-ink-muted uppercase">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-extrabold">
                      {copy.id}
                    </th>
                    <th scope="col" className="px-3 py-2 font-extrabold">
                      Nama
                    </th>
                    {copy.withClass && (
                      <th scope="col" className="px-3 py-2 font-extrabold">
                        Kelas
                      </th>
                    )}
                    <th scope="col" className="px-3 py-2 font-extrabold">
                      Kode akses
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stage.rows.slice(0, 6).map((row) => (
                    <tr key={row.nis} className="border-t border-line-soft">
                      <td className="px-3 py-2 font-mono">{row.nis}</td>
                      <td className="px-3 py-2">{row.name}</td>
                      {copy.withClass && (
                        <td className="px-3 py-2">
                          {row.className}
                          {!knownClasses.has(row.className.toLowerCase()) && (
                            <span className="ml-1.5 rounded-full bg-warning-bg px-1.5 py-0.5 text-[10px] font-bold text-warning-ink">
                              baru
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2 text-ink-muted">{row.generatedCode ? 'dibuat otomatis' : 'dari berkas'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-line-soft px-3 py-2 text-xs text-ink-muted">
                {stage.rows.length > 6 && `… dan ${formatNumber(stage.rows.length - 6)} baris lainnya. `}
                {copy.id} yang sudah terdaftar akan dilewati saat impor.
              </p>
            </div>
          )}

          {importMutation.isError && (
            <div className="mt-4">
              <ErrorNotice message={errorMessage(importMutation.error)} />
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setStage({ step: 'pick' })}
              disabled={importMutation.isPending}
              className="btn btn-outline h-11"
            >
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
                : `Impor ${formatNumber(stage.rows.length)} ${copy.nounPlural}`}
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
            <li>
              {formatNumber(stage.result.created)} {copy.nounPlural} ditambahkan
            </li>
            <li>
              {formatNumber(stage.result.skipped)} dilewati ({copy.id} sudah terdaftar)
            </li>
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
                  Unduh daftar kode akses sekarang untuk dibagikan ke {copy.nounPlural}. Kode akses tidak disimpan dalam bentuk aslinya,
                  jadi <strong>tidak dapat ditampilkan lagi</strong> setelah jendela ini ditutup.
                </span>
              </p>
              <button type="button" onClick={downloadCodes} className="btn btn-primary mt-3 h-10">
                <Download aria-hidden className="size-4" /> Unduh kode akses (CSV)
              </button>
              {stage.downloaded && <p className="mt-2 text-[13px] font-semibold text-success-ink">Berkas sudah diunduh.</p>}
            </div>
          )}
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={close}
              className={cn('btn h-11', mustDownload ? 'text-danger-ink hover:bg-danger-bg' : 'btn-outline')}
            >
              {mustDownload ? 'Tutup tanpa mengunduh' : 'Tutup'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

/** Satu permintaan maksimal 200 baris di server; dikirim per 100 agar tiap permintaan cepat selesai. */
const BULK_CHUNK = 100;

interface BulkResult {
  updated: number;
  accessCodesReset: number;
  classChanged: number;
}

type CodeMode = 'none' | 'random' | 'same';

/** Ubah massal: pindah kelas (khusus siswa) dan/atau kode akses baru. */
function BulkEditModal({ role, voters: picked, open, onClose }: { role: VoterRole; voters: Voter[]; open: boolean; onClose: () => void }) {
  const copy = COPY[role];
  // Dibekukan saat dialog dibuka: daftar di halaman bisa berubah setelah data dimuat ulang.
  const [voters, setVoters] = useState<Voter[]>([]);
  const queryClient = useQueryClient();
  const toast = useToast();
  const classes = useClasses();
  const [classId, setClassId] = useState<number | ''>('');
  const [codeMode, setCodeMode] = useState<CodeMode>('none');
  const [sharedCode, setSharedCode] = useState('');
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState<{ result: BulkResult; codes: Array<{ voter: Voter; password: string }>; downloaded: boolean } | null>(null);
  const [lastOpen, setLastOpen] = useState(false);

  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setVoters(picked);
      setClassId('');
      setCodeMode('none');
      setSharedCode('');
      setProgress(0);
      setDone(null);
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      const codes =
        codeMode === 'none'
          ? []
          : voters.map((voter) => ({ voter, password: codeMode === 'random' ? randomAccessCode() : sharedCode }));
      const total: BulkResult = { updated: 0, accessCodesReset: 0, classChanged: 0 };
      setProgress(0);
      for (let i = 0; i < voters.length; i += BULK_CHUNK) {
        const chunk = voters.slice(i, i + BULK_CHUNK);
        const ids = chunk.map((voter) => voter.id);
        const result = await api<BulkResult>(`${VOTER_ENDPOINT[role]}/bulk-update`, {
          method: 'POST',
          body: {
            ids,
            ...(copy.withClass && classId !== '' ? { classId } : {}),
            ...(codes.length ? { codes: codes.filter((c) => ids.includes(c.voter.id)).map((c) => ({ id: c.voter.id, password: c.password })) } : {}),
          },
        });
        total.updated += result.updated;
        total.accessCodesReset += result.accessCodesReset;
        total.classChanged += result.classChanged;
        setProgress(i + chunk.length);
      }
      return { total, codes };
    },
    onSuccess: ({ total, codes }) => {
      invalidateVoters(queryClient, copy);
      setDone({ result: total, codes, downloaded: false });
      if (!codes.length) {
        toast(`${formatNumber(total.updated)} data ${copy.noun} diperbarui.`, 'success');
        onClose();
      }
    },
  });

  function downloadCodes() {
    if (!done?.codes.length) return;
    const header = copy.withClass ? [copy.id, 'Nama', 'Kelas', 'Kode Akses'] : [copy.id, 'Nama', 'Kode Akses'];
    const rows = done.codes.map(({ voter, password }) =>
      copy.withClass ? [voter.nis, voter.name, voter.className ?? '', password] : [voter.nis, voter.name, password],
    );
    downloadText(`kode-akses-${copy.noun}-${wibDateKey(new Date())}.csv`, toCsv([header, ...rows]));
    setDone({ ...done, downloaded: true });
  }

  const nothingSelected = (!copy.withClass || classId === '') && codeMode === 'none';
  const sharedTooShort = codeMode === 'same' && sharedCode.trim().length < 6;
  const mustDownload = Boolean(done?.codes.length) && !done?.downloaded;

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!save.isPending && !mustDownload}
      labelledBy="ubah-massal-judul"
      panelClassName="max-w-[520px]"
    >
      <div className="p-6 sm:p-7">
        <h2 id="ubah-massal-judul" className="text-xl font-extrabold">
          Ubah {formatNumber(voters.length)} {copy.noun} Terpilih
        </h2>

        {done ? (
          <>
            <p className="mt-3 flex items-center gap-2 text-sm font-bold text-success-ink" role="status">
              <CircleCheck aria-hidden className="size-5" /> Perubahan tersimpan
            </p>
            <ul className="mt-2 space-y-1 text-sm text-ink-body">
              {done.result.classChanged > 0 && <li>{formatNumber(done.result.classChanged)} pindah kelas</li>}
              {done.result.accessCodesReset > 0 && <li>{formatNumber(done.result.accessCodesReset)} kode akses diganti</li>}
            </ul>
            {done.codes.length > 0 && (
              <div className="mt-4 rounded-card border border-line bg-canvas p-4">
                <p className="flex items-start gap-2 text-[13px] leading-normal text-ink-body">
                  <KeyRound aria-hidden className="mt-0.5 size-4 shrink-0 text-royal" />
                  <span>
                    Unduh kode akses baru sekarang untuk dibagikan. Kode disimpan ter-hash, jadi{' '}
                    <strong>tidak dapat ditampilkan lagi</strong> setelah jendela ini ditutup. Semua sesi {copy.noun} tersebut sudah
                    dikeluarkan.
                  </span>
                </p>
                <button type="button" onClick={downloadCodes} className="btn btn-primary mt-3 h-10">
                  <Download aria-hidden className="size-4" /> Unduh kode akses (CSV)
                </button>
                {done.downloaded && <p className="mt-2 text-[13px] font-semibold text-success-ink">Berkas sudah diunduh.</p>}
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={onClose} className={cn('btn h-11', mustDownload ? 'text-danger-ink hover:bg-danger-bg' : 'btn-outline')}>
                {mustDownload ? 'Tutup tanpa mengunduh' : 'Tutup'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-1.5 text-[13px] text-ink-muted">
              Hanya bagian yang Anda pilih di bawah yang diubah; sisanya dibiarkan apa adanya.
            </p>

            {copy.withClass && (
              <div className="mt-5">
                <label htmlFor="massal-kelas" className="field-label">
                  Pindahkan ke kelas
                </label>
                <ClassSelect
                  id="massal-kelas"
                  classes={classes.data}
                  value={classId}
                  onChange={setClassId}
                  placeholder="Tidak diubah"
                  className="field-input h-11 text-sm"
                />
              </div>
            )}

            <fieldset className="mt-5">
              <legend className="field-label">Kode akses</legend>
              <div className="mt-1 grid gap-2">
                {[
                  { value: 'none' as const, label: 'Tidak diubah', hint: `${copy.noun} tetap memakai kode akses lama.` },
                  { value: 'random' as const, label: 'Buat kode acak berbeda tiap orang', hint: 'Paling aman; unduh daftarnya setelah disimpan.' },
                  { value: 'same' as const, label: 'Satu kode yang sama untuk semua', hint: 'Praktis untuk kelas yang dibagikan langsung.' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-start gap-2.5 rounded-control border border-line px-3.5 py-2.5 text-sm has-[:checked]:border-royal has-[:checked]:bg-royal-soft"
                  >
                    <input
                      type="radio"
                      name="massal-kode"
                      value={option.value}
                      checked={codeMode === option.value}
                      onChange={() => setCodeMode(option.value)}
                      className="mt-0.5 size-4 accent-royal"
                    />
                    <span>
                      <span className="block font-bold">{option.label}</span>
                      <span className="block text-xs text-ink-muted">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              {codeMode === 'same' && (
                <div className="mt-2.5 flex gap-2">
                  <input
                    aria-label="Kode akses baru untuk semua"
                    value={sharedCode}
                    onChange={(e) => setSharedCode(e.target.value)}
                    autoComplete="off"
                    className="field-input h-11 font-mono text-sm"
                  />
                  <button type="button" onClick={() => setSharedCode(randomAccessCode())} className="btn btn-outline h-11 shrink-0 px-3 text-[13px]">
                    Buat acak
                  </button>
                </div>
              )}
              {sharedTooShort && <p className="field-error">Kode akses minimal 6 karakter.</p>}
            </fieldset>

            {save.isError && (
              <div className="mt-4">
                <ErrorNotice message={errorMessage(save.error)} />
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} disabled={save.isPending} className="btn btn-outline h-11">
                Batal
              </button>
              <button
                type="button"
                onClick={() => save.mutate()}
                disabled={save.isPending || nothingSelected || sharedTooShort}
                className="btn btn-primary h-11 sm:min-w-40"
              >
                {save.isPending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
                {save.isPending ? `Menyimpan… ${formatNumber(progress)}/${formatNumber(voters.length)}` : 'Simpan Perubahan'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

const SKIP_REASON: Record<string, string> = { sudah_memilih: 'sudah memilih', kandidat: 'terdaftar sebagai kandidat' };

/** Hapus massal; pemilih yang sudah memilih atau menjadi kandidat otomatis dilewati. */
function BulkDeleteModal({ role, voters: picked, open, onClose }: { role: VoterRole; voters: Voter[]; open: boolean; onClose: () => void }) {
  const copy = COPY[role];
  const [voters, setVoters] = useState<Voter[]>([]);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [result, setResult] = useState<{ deleted: number; skipped: Array<{ nis: string; name: string; reason: string }> } | null>(null);
  const [lastOpen, setLastOpen] = useState(false);

  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setVoters(picked);
      setResult(null);
    }
  }

  const remove = useMutation({
    mutationFn: async () => {
      const total = { deleted: 0, skipped: [] as Array<{ nis: string; name: string; reason: string }> };
      for (let i = 0; i < voters.length; i += BULK_CHUNK) {
        const chunk = voters.slice(i, i + BULK_CHUNK);
        const res = await api<typeof total>(`${VOTER_ENDPOINT[role]}/bulk-delete`, {
          method: 'POST',
          body: { ids: chunk.map((voter) => voter.id) },
        });
        total.deleted += res.deleted;
        total.skipped.push(...res.skipped);
      }
      return total;
    },
    onSuccess: (total) => {
      invalidateVoters(queryClient, copy);
      if (total.skipped.length === 0) {
        toast(`${formatNumber(total.deleted)} data ${copy.noun} dihapus.`, 'success');
        onClose();
        return;
      }
      setResult(total);
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  return (
    <Modal open={open} onClose={onClose} dismissible={!remove.isPending} role="alertdialog" labelledBy="hapus-massal-judul" panelClassName="max-w-[480px] p-6">
      <h2 id="hapus-massal-judul" className="flex items-center gap-2 text-lg font-extrabold">
        <CircleAlert aria-hidden className="size-5 text-danger" /> Hapus {formatNumber(voters.length)} data {copy.noun}?
      </h2>

      {result ? (
        <>
          <p className="mt-2.5 text-sm text-ink-body">
            {formatNumber(result.deleted)} data dihapus. {formatNumber(result.skipped.length)} dilewati agar rekap suara tetap valid:
          </p>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-control border border-line bg-canvas px-3.5 py-2.5 text-[13px]">
            {result.skipped.map((item) => (
              <li key={item.nis}>
                <span className="font-semibold">{item.name}</span> <span className="text-ink-muted">({item.nis})</span> —{' '}
                {SKIP_REASON[item.reason] ?? item.reason}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex justify-end">
            <button type="button" onClick={onClose} className="btn btn-outline h-10">
              Tutup
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-ink-body">
            Data yang dipilih akan dihapus dan tidak dapat lagi masuk untuk memilih. {copy.noun} yang sudah memilih atau terdaftar
            sebagai kandidat otomatis dilewati.
          </p>
          <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={remove.isPending} className="btn btn-outline h-10">
              Batal
            </button>
            <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} className="btn btn-danger h-10">
              {remove.isPending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
              {remove.isPending ? 'Menghapus…' : 'Hapus Terpilih'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

/** Halaman panitia untuk mengelola pemilih: dipakai oleh Data Siswa dan Data Guru. */
export function VotersPage({ role }: { role: VoterRole }) {
  const copy = COPY[role];
  const queryClient = useQueryClient();
  const toast = useToast();
  const classes = useClasses();
  const [searchParams] = useSearchParams();
  const initialClassId = Number(searchParams.get('classId'));
  const [filters, setFilters] = useState<VoterFilters>({
    page: 1,
    voted: 'all',
    classId: copy.withClass && Number.isInteger(initialClassId) && initialClassId > 0 ? initialClassId : '',
    gradeLevel: '',
  });
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim());
  const voters = useVoters(role, { ...filters, q });
  const eligibleCategories = voters.data?.eligibleCategories ?? 0;

  const [editing, setEditing] = useState<Voter | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleting, setDeleting] = useState<Voter | null>(null);
  /** Pilihan massal berlaku untuk baris yang sedang tampil; berganti filter/halaman mengosongkannya. */
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const rows = voters.data?.voters ?? [];
  const selected = rows.filter((voter) => selectedIds.includes(voter.id));
  const allSelected = rows.length > 0 && selected.length === rows.length;
  const toggle = (id: number) => setSelectedIds((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));

  const remove = useMutation({
    mutationFn: (id: number) => api(`${VOTER_ENDPOINT[role]}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidateVoters(queryClient, copy);
      toast(`Data ${copy.noun} dihapus.`, 'success');
      setDeleting(null);
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const update = (patch: Partial<VoterFilters>) => {
    setSelectedIds([]);
    setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  };
  const label = copy.title.replace('Data ', '');

  return (
    <>
      <AdminPageHeader
        title={copy.title}
        description={copy.description}
        actions={
          <>
            <button type="button" onClick={() => setImportOpen(true)} className="btn btn-outline h-10">
              <FileUp aria-hidden className="size-4" /> Impor {label}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="btn btn-primary h-10"
            >
              <Plus aria-hidden className="size-4" /> Tambah {label}
            </button>
          </>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1 sm:max-w-xs">
          <label htmlFor="cari-pemilih" className="field-label">
            Cari {copy.id} atau nama
          </label>
          <input
            id="cari-pemilih"
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              update({});
            }}
            className="field-input h-10 text-sm"
          />
        </div>
        {copy.withClass && (
          <>
            <div>
              <label htmlFor="filter-tingkat" className="field-label">
                Tingkat
              </label>
              <select
                id="filter-tingkat"
                value={filters.gradeLevel}
                onChange={(e) =>
                  update({
                    gradeLevel: e.target.value as GradeFilter,
                    classId: '',
                  })
                }
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
          </>
        )}
        <div>
          <label htmlFor="filter-status" className="field-label">
            Status voting
          </label>
          <select
            id="filter-status"
            value={filters.voted}
            onChange={(e) => update({ voted: e.target.value as VoterFilters['voted'] })}
            className={selectClass}
          >
            <option value="all">Semua</option>
            <option value="yes">Sudah memilih</option>
            <option value="no">Belum memilih</option>
          </select>
        </div>
      </div>

      <Panel className={cn('transition-opacity', voters.isPlaceholderData && 'opacity-60')}>
        {voters.isError ? (
          <ErrorNotice message={errorMessage(voters.error)} onRetry={() => void voters.refetch()} />
        ) : !voters.data ? (
          <div aria-hidden className="h-72 animate-pulse rounded-card bg-line-soft" />
        ) : voters.data.voters.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">Tidak ada {copy.noun} yang cocok dengan filter.</p>
        ) : (
          <>
            {selected.length > 0 && (
              <div
                role="group"
                aria-label="Aksi massal"
                className="mb-3 flex flex-wrap items-center gap-2.5 rounded-control border border-royal/30 bg-royal-soft px-3.5 py-2.5"
              >
                <span className="text-[13px] font-extrabold text-navy">
                  {formatNumber(selected.length)} {copy.noun} dipilih
                </span>
                <button type="button" onClick={() => setBulkEditOpen(true)} className="btn btn-outline h-9 px-3 text-[13px]">
                  <SquarePen aria-hidden className="size-3.5" /> Ubah Massal
                </button>
                <button
                  type="button"
                  onClick={() => setBulkDeleteOpen(true)}
                  className="btn h-9 border border-danger-line bg-white px-3 text-[13px] text-danger-ink hover:bg-danger-bg"
                >
                  <Trash aria-hidden className="size-3.5" /> Hapus Terpilih
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="btn h-9 px-2 text-[13px] text-ink-muted hover:text-ink sm:ml-auto"
                >
                  <X aria-hidden className="size-3.5" /> Batal pilih
                </button>
              </div>
            )}
            <TableSwipeHint />
            <div className="-mx-1 table-scroll px-1">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <caption className="sr-only">Daftar {copy.noun}</caption>
                <thead>
                  <tr className="border-b border-line-soft text-[11px] tracking-[0.06em] text-ink-muted uppercase">
                    <th scope="col" className="w-10 pb-2.5">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(node) => {
                          if (node) node.indeterminate = selected.length > 0 && !allSelected;
                        }}
                        onChange={() => setSelectedIds(allSelected ? [] : rows.map((voter) => voter.id))}
                        aria-label={allSelected ? 'Batalkan pilihan semua baris' : 'Pilih semua baris di halaman ini'}
                        className="size-4 accent-royal"
                      />
                    </th>
                    <th scope="col" className="pb-2.5 font-extrabold">
                      {copy.id}
                    </th>
                    <th scope="col" className="pb-2.5 font-extrabold">
                      Nama
                    </th>
                    {copy.withClass && (
                      <th scope="col" className="pb-2.5 font-extrabold">
                        Kelas
                      </th>
                    )}
                    <th scope="col" className="pb-2.5 font-extrabold">
                      Status voting
                    </th>
                    <th scope="col" className="pb-2.5 text-right font-extrabold">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((voter) => (
                    <tr key={voter.id} className={cn('border-b border-canvas last:border-0', selectedIds.includes(voter.id) && 'bg-royal-soft/60')}>
                      <td className="py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(voter.id)}
                          onChange={() => toggle(voter.id)}
                          aria-label={`Pilih ${voter.name}`}
                          className="size-4 accent-royal"
                        />
                      </td>
                      <td className="py-3 pr-3 font-mono text-[13px]">{voter.nis}</td>
                      <td className="py-3 pr-3 font-semibold">
                        {voter.name}
                        {voter.candidacies.map((candidacy) => (
                          <span
                            key={candidacy.categoryId}
                            className="ml-2 rounded-full bg-royal-soft px-2 py-0.5 text-[11px] font-bold text-royal"
                          >
                            {candidacy.categoryName} No. {candidacy.candidateNumber}
                          </span>
                        ))}
                      </td>
                      {copy.withClass && <td className="py-3 pr-3 text-ink-body">{voter.className ?? '—'}</td>}
                      <td className="py-3 pr-3">
                        {voter.votedCount > 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-1 text-xs font-bold text-success-ink">
                            <CircleCheck aria-hidden className="size-3.5" /> {voter.votedCount}
                            {eligibleCategories > 0 && `/${eligibleCategories}`} kategori
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
                            setEditing(voter);
                            setFormOpen(true);
                          }}
                          className="btn h-9 px-2.5 text-[13px] text-royal hover:bg-royal-soft"
                        >
                          <Pencil aria-hidden className="size-3.5" /> Edit
                          <span className="sr-only"> {voter.name}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(voter)}
                          disabled={voter.votedCount > 0 || voter.candidacies.length > 0}
                          title={
                            voter.votedCount > 0
                              ? 'Pemilih yang sudah memilih tidak dapat dihapus'
                              : voter.candidacies.length > 0
                                ? 'Pemilih yang menjadi kandidat tidak dapat dihapus'
                                : undefined
                          }
                          className="btn h-9 px-2.5 text-[13px] text-ink-muted hover:bg-danger-bg hover:text-danger-ink"
                        >
                          <Trash aria-hidden className="size-3.5" /> Hapus
                          <span className="sr-only"> {voter.name}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={filters.page}
              pageSize={voters.data.pageSize}
              total={voters.data.total}
              onPageChange={(page) => update({ page })}
            />
          </>
        )}
      </Panel>

      <BulkEditModal
        role={role}
        voters={selected}
        open={bulkEditOpen}
        onClose={() => {
          setBulkEditOpen(false);
          setSelectedIds([]);
        }}
      />
      <BulkDeleteModal
        role={role}
        voters={selected}
        open={bulkDeleteOpen}
        onClose={() => {
          setBulkDeleteOpen(false);
          setSelectedIds([]);
        }}
      />

      <VoterFormModal role={role} voter={editing} open={formOpen} onClose={() => setFormOpen(false)} />
      <ImportModal role={role} open={importOpen} onClose={() => setImportOpen(false)} />

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        dismissible={!remove.isPending}
        role="alertdialog"
        labelledBy="hapus-pemilih-judul"
        panelClassName="max-w-[420px] p-6"
      >
        <h2 id="hapus-pemilih-judul" className="flex items-center gap-2 text-lg font-extrabold">
          <CircleAlert aria-hidden className="size-5 text-danger" /> Hapus data {copy.noun}?
        </h2>
        <p className="mt-2 text-sm text-ink-body">
          {deleting?.name} ({copy.id} {deleting?.nis}) akan dihapus dan tidak dapat lagi masuk untuk memilih.
        </p>
        <div className="mt-5 flex justify-end gap-2.5">
          <button type="button" onClick={() => setDeleting(null)} disabled={remove.isPending} className="btn btn-outline h-10">
            Batal
          </button>
          <button
            type="button"
            onClick={() => deleting && remove.mutate(deleting.id)}
            disabled={remove.isPending}
            className="btn btn-danger h-10"
          >
            {remove.isPending ? 'Menghapus…' : 'Hapus'}
          </button>
        </div>
      </Modal>
    </>
  );
}
