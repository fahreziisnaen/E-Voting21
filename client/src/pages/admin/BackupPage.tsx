import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, Download, FileJson, LoaderCircle, RotateCcw, ShieldAlert, TriangleAlert, Upload } from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { AdminPageHeader, ErrorNotice, Panel } from '../../features/admin/AdminUi';
import { useElection, useLogout } from '../../hooks/queries';
import { api, downloadFile, errorMessage } from '../../lib/api';
import { formatDateTime, formatNumber, wibDateKey } from '../../lib/format';

interface BackupSummary {
  createdAt: string;
  electionName: string | null;
  classes: number;
  students: number;
  teachers: number;
  admins: number;
  categories: number;
  candidates: number;
  votes: number;
  auditLogs: number;
}

const SUMMARY_ROWS: Array<[keyof BackupSummary, string]> = [
  ['categories', 'Kategori'],
  ['candidates', 'Kandidat'],
  ['students', 'Siswa'],
  ['teachers', 'Guru'],
  ['classes', 'Kelas'],
  ['votes', 'Suara'],
  ['admins', 'Akun panitia'],
  ['auditLogs', 'Baris audit log'],
];

function SummaryTable({ summary }: { summary: BackupSummary }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-4">
      {SUMMARY_ROWS.map(([key, label]) => (
        <div key={key} className="rounded-control border border-line bg-canvas px-3 py-2">
          <dt className="text-[11px] font-bold tracking-[0.04em] text-ink-muted uppercase">{label}</dt>
          <dd className="mt-0.5 text-lg font-extrabold tabular-nums">{formatNumber(summary[key] as number)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Dialog konfirmasi untuk aksi merusak: wajib mengetik kata kunci + kata sandi panitia. */
function ConfirmDangerModal({
  open,
  title,
  word,
  description,
  submitLabel,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  word: string;
  description: React.ReactNode;
  submitLabel: string;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (password: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const [lastOpen, setLastOpen] = useState(false);

  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setPassword('');
      setTyped('');
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    onConfirm(password);
  }

  return (
    <Modal open={open} onClose={onClose} dismissible={!pending} role="alertdialog" labelledBy="konfirmasi-bahaya" panelClassName="max-w-[480px]">
      <form onSubmit={submit} noValidate className="p-6 sm:p-7">
        <h2 id="konfirmasi-bahaya" className="flex items-center gap-2 text-lg font-extrabold">
          <ShieldAlert aria-hidden className="size-5 text-danger" /> {title}
        </h2>
        <div className="mt-2.5 text-sm leading-normal text-ink-body">{description}</div>

        <label htmlFor="konfirmasi-kata" className="field-label mt-5">
          Ketik <span className="font-mono">{word}</span> untuk melanjutkan
        </label>
        <input
          id="konfirmasi-kata"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="field-input h-11 font-mono text-sm"
        />

        <label htmlFor="konfirmasi-sandi" className="field-label mt-4">
          Kata sandi panitia
        </label>
        <input
          id="konfirmasi-sandi"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="field-input h-11 text-sm"
        />

        {error && (
          <div className="mt-4">
            <ErrorNotice message={error} />
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={pending} className="btn btn-outline h-11">
            Batal
          </button>
          <button type="submit" disabled={pending || typed !== word || !password} className="btn btn-danger h-11">
            {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {pending ? 'Memproses…' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function BackupPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const logout = useLogout();
  const election = useElection().data;
  const votingRunning = election?.phase === 'active' || election?.phase === 'outside_hours';

  const [file, setFile] = useState<{ name: string; backup: unknown; summary: BackupSummary } | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const download = useMutation({
    mutationFn: () => downloadFile('/admin/backup', `cadangan-evoting-${wibDateKey(new Date())}.json`),
    onSuccess: () => toast('Berkas cadangan berhasil diunduh. Simpan di tempat yang aman.', 'success'),
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const restore = useMutation({
    mutationFn: (password: string) =>
      api<{ message: string }>('/admin/restore', { method: 'POST', body: { backup: file?.backup, password, confirm: 'PULIHKAN' } }),
    onSuccess: (data) => {
      setRestoreOpen(false);
      setFile(null);
      toast(data.message, 'success');
      // Seluruh akun (termasuk panitia) diganti isi cadangan → mulai dari layar masuk.
      queryClient.clear();
      logout.mutate();
    },
  });

  const reset = useMutation({
    mutationFn: (password: string) => api<{ message: string }>('/admin/factory-reset', { method: 'POST', body: { password, confirm: 'RESET' } }),
    onSuccess: (data) => {
      setResetOpen(false);
      void queryClient.invalidateQueries();
      toast(data.message, 'success');
    },
  });

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (!picked) return;
    setReading(true);
    setReadError(null);
    setFile(null);
    try {
      const backup = JSON.parse(await picked.text());
      const { summary } = await api<{ summary: BackupSummary }>('/admin/restore/preview', { method: 'POST', body: { backup } });
      setFile({ name: picked.name, backup, summary });
    } catch (err) {
      setReadError(err instanceof SyntaxError ? 'Berkas bukan JSON yang valid. Pilih berkas cadangan dari aplikasi ini.' : errorMessage(err));
    } finally {
      setReading(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Cadangan & Reset"
        description="Unduh salinan seluruh data, pulihkan dari berkas cadangan, atau kosongkan aplikasi untuk pemilihan baru."
      />

      {votingRunning && (
        <p className="flex items-start gap-2.5 rounded-card border border-warning-line bg-warning-bg px-4 py-3 text-[13px] leading-normal font-semibold text-warning-ink">
          <TriangleAlert aria-hidden className="mt-px size-4 shrink-0" />
          Pemungutan suara sedang berlangsung. Cadangan tetap bisa diunduh, tetapi pemulihan dan reset baru bisa dilakukan setelah
          pemungutan suara ditutup di menu Jadwal Voting.
        </p>
      )}

      <Panel
        title="Unduh Cadangan"
        titleId="unduh-judul"
        description="Berisi jadwal, kategori, kandidat, kelas, seluruh akun (siswa, guru, panitia), suara yang masuk, dan audit log."
      >
        <button type="button" onClick={() => download.mutate()} disabled={download.isPending} className="btn btn-primary h-11">
          {download.isPending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Download aria-hidden className="size-4" />}
          Unduh Cadangan (JSON)
        </button>
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-[13px] leading-normal text-ink-muted">
          <li>
            <strong className="text-ink">Foto kandidat dan foto gedung tidak ikut di dalam berkas ini.</strong> Salin juga folder{' '}
            <code className="font-mono text-xs">server/uploads/</code> (atau volume Docker <code className="font-mono text-xs">evoting-uploads</code>).
          </li>
          <li>
            Berkas memuat data pribadi pemilih dan hash kode akses. Simpan seperti dokumen rahasia sekolah — jangan dibagikan di grup
            atau diunggah ke layanan publik.
          </li>
          <li>Unduh cadangan sebelum impor massal, sebelum mengubah jadwal, dan setelah pemungutan suara ditutup.</li>
        </ul>
      </Panel>

      <Panel
        title="Pulihkan dari Cadangan"
        titleId="pulihkan-judul"
        description="Seluruh data saat ini diganti dengan isi berkas cadangan — termasuk akun panitia, sehingga Anda perlu masuk kembali."
      >
        <label
          htmlFor="berkas-cadangan"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-line-strong bg-canvas px-4 py-8 text-center transition-colors hover:border-royal has-[:focus-visible]:border-royal"
        >
          {reading ? <LoaderCircle aria-hidden className="size-7 animate-spin text-royal" /> : <FileJson aria-hidden className="size-7 text-royal" />}
          <span className="text-sm font-bold">{reading ? 'Membaca berkas…' : 'Pilih berkas cadangan (.json)'}</span>
          <input id="berkas-cadangan" type="file" accept="application/json,.json" onChange={(e) => void onFile(e)} className="sr-only" disabled={reading} />
        </label>

        {readError && (
          <div className="mt-4">
            <ErrorNotice message={readError} />
          </div>
        )}

        {file && (
          <div className="mt-4 rounded-card border border-line p-4">
            <p className="text-sm font-bold">{file.name}</p>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              Dibuat {formatDateTime(file.summary.createdAt)}
              {file.summary.electionName ? ` · ${file.summary.electionName}` : ''}
            </p>
            <SummaryTable summary={file.summary} />
            <button
              type="button"
              onClick={() => setRestoreOpen(true)}
              disabled={votingRunning}
              title={votingRunning ? 'Tutup pemungutan suara terlebih dahulu' : undefined}
              className="btn btn-danger mt-4 h-11"
            >
              <Upload aria-hidden className="size-4" /> Pulihkan Data Ini
            </button>
          </div>
        )}
      </Panel>

      <section aria-labelledby="reset-judul" className="rounded-panel border-2 border-danger-line bg-danger-bg p-5 sm:p-[22px]">
        <h2 id="reset-judul" className="flex items-center gap-2 text-[17px] font-extrabold text-danger-ink">
          <CircleAlert aria-hidden className="size-5" /> Reset Pabrik
        </h2>
        <p className="mt-1.5 text-[13px] leading-normal text-danger-ink">
          Menghapus <strong>semua</strong> kategori, kandidat, siswa, guru, kelas, suara, audit log, dan foto yang diunggah. Jadwal
          dikembalikan ke draf dan hanya akun panitia Anda yang tersisa. Tindakan ini tidak dapat dibatalkan — unduh cadangan terlebih
          dahulu.
        </p>
        <button
          type="button"
          onClick={() => setResetOpen(true)}
          disabled={votingRunning}
          title={votingRunning ? 'Tutup pemungutan suara terlebih dahulu' : undefined}
          className="btn btn-danger mt-4 h-11"
        >
          <RotateCcw aria-hidden className="size-4" /> Reset ke Kondisi Awal
        </button>
      </section>

      <ConfirmDangerModal
        open={restoreOpen}
        title="Pulihkan seluruh data?"
        word="PULIHKAN"
        description={
          <>
            Data saat ini akan <strong>dihapus permanen</strong> dan diganti isi berkas{' '}
            <span className="font-semibold">{file?.name}</span>. Setelah selesai Anda akan keluar otomatis dan perlu masuk dengan akun
            panitia dari cadangan tersebut.
          </>
        }
        submitLabel="Pulihkan Sekarang"
        pending={restore.isPending}
        error={restore.isError ? errorMessage(restore.error) : undefined}
        onClose={() => setRestoreOpen(false)}
        onConfirm={(password) => restore.mutate(password)}
      />

      <ConfirmDangerModal
        open={resetOpen}
        title="Reset ke kondisi awal?"
        word="RESET"
        description={
          <>
            Semua data pemilihan dihapus permanen. Hanya akun panitia Anda yang tersisa, dan jadwal kembali menjadi draf. Pastikan Anda
            sudah <strong>mengunduh cadangan</strong>.
          </>
        }
        submitLabel="Reset Sekarang"
        pending={reset.isPending}
        error={reset.isError ? errorMessage(reset.error) : undefined}
        onClose={() => setResetOpen(false)}
        onConfirm={(password) => reset.mutate(password)}
      />
    </>
  );
}
