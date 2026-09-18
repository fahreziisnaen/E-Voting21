import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Info, LoaderCircle, Pencil, Plus, Trash } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CandidateBadge, CandidatePhoto } from '../../components/CandidateVisuals';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { AdminPageHeader, ErrorNotice, Panel, selectClass } from '../../features/admin/AdminUi';
import { PersonPicker, type PickedPerson } from '../../features/admin/PersonPicker';
import { useAdminCandidates, useAdminCategories } from '../../hooks/admin';
import { useElection } from '../../hooks/queries';
import { api, errorMessage, fieldErrors } from '../../lib/api';
import { cn } from '../../lib/cn';
import { personMeta, VOTER_SCOPE_LABEL } from '../../lib/voting';
import type { AdminCandidate, AdminCategory } from '../../types';

interface FormState {
  categoryId: number | '';
  candidateNumber: string;
  person: PickedPerson | null;
  vision: string;
  mission: string;
  programs: string;
  organizationHistory: string;
}

type TextField = Exclude<keyof FormState, 'person' | 'categoryId'>;

const EMPTY_FORM: FormState = {
  categoryId: '',
  candidateNumber: '',
  person: null,
  vision: '',
  mission: '',
  programs: '',
  organizationHistory: '',
};
const lines = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean);

function toForm(candidate: AdminCandidate): FormState {
  return {
    categoryId: candidate.categoryId,
    candidateNumber: String(candidate.candidateNumber),
    person: { id: candidate.userId, nis: candidate.nis, name: candidate.name, role: candidate.role, className: candidate.className || null },
    vision: candidate.vision,
    mission: candidate.mission.join('\n'),
    programs: candidate.programs.join('\n'),
    organizationHistory: candidate.organizationHistory.join('\n'),
  };
}

/** Nomor urut berikutnya dihitung per kategori. */
function nextNumberIn(candidates: AdminCandidate[], categoryId: number | ''): number {
  const used = candidates.filter((c) => c.categoryId === categoryId).map((c) => c.candidateNumber);
  return Math.max(0, ...used) + 1;
}

function CandidateFormModal({
  candidate,
  open,
  onClose,
  candidates,
  categories,
  defaultCategoryId,
  identityLocked,
}: {
  candidate: AdminCandidate | null;
  open: boolean;
  onClose: () => void;
  candidates: AdminCandidate[];
  categories: AdminCategory[];
  defaultCategoryId: number | '';
  /** Saat pemungutan suara berlangsung, kategori, nomor urut & orangnya dikunci. */
  identityLocked: boolean;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [personMissing, setPersonMissing] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);

  // Isi ulang form setiap kali modal dibuka untuk kandidat berbeda.
  const key = open ? String(candidate?.id ?? 'baru') : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (key) {
      const categoryId = defaultCategoryId === '' ? (categories[0]?.id ?? '') : defaultCategoryId;
      setForm(
        candidate
          ? toForm(candidate)
          : { ...EMPTY_FORM, categoryId, candidateNumber: String(nextNumberIn(candidates, categoryId)) },
      );
      setPersonMissing(false);
    }
  }

  const save = useMutation({
    mutationFn: (body: object) =>
      candidate ? api(`/admin/candidates/${candidate.id}`, { method: 'PUT', body }) : api('/admin/candidates', { method: 'POST', body }),
    onSuccess: () => {
      for (const key of ['candidates', 'categories', 'students', 'teachers']) {
        void queryClient.invalidateQueries({ queryKey: ['admin', key] });
      }
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast(candidate ? 'Data kandidat diperbarui.' : 'Kandidat ditambahkan.', 'success');
      onClose();
    },
  });
  const errors = fieldErrors(save.error);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.person) {
      setPersonMissing(true);
      return;
    }
    save.mutate({
      categoryId: form.categoryId === '' ? undefined : form.categoryId,
      candidateNumber: Number(form.candidateNumber),
      userId: form.person.id,
      vision: form.vision,
      mission: lines(form.mission),
      programs: lines(form.programs),
      organizationHistory: lines(form.organizationHistory),
    });
  }

  const personError = errors.userId ?? (personMissing && !form.person ? 'Pilih siswa atau guru sebagai kandidat.' : undefined);
  const locked = Boolean(candidate) && identityLocked;
  const categoryLocked = locked || (candidate?.hasVotes ?? false);
  const category = categories.find((c) => c.id === form.categoryId);

  const field = (name: TextField, label: string, props: { hint?: string; multiline?: number; type?: string; disabled?: boolean } = {}) => (
    <div>
      <label htmlFor={`kandidat-${name}`} className="field-label">
        {label}
      </label>
      {props.multiline ? (
        <textarea
          id={`kandidat-${name}`}
          rows={props.multiline}
          value={form[name]}
          onChange={(e) => setForm({ ...form, [name]: e.target.value })}
          aria-invalid={Boolean(errors[name])}
          aria-describedby={`kandidat-${name}-hint`}
          className="field-input h-auto py-2.5 text-sm leading-relaxed"
        />
      ) : (
        <input
          id={`kandidat-${name}`}
          type={props.type ?? 'text'}
          value={form[name]}
          disabled={props.disabled}
          onChange={(e) => setForm({ ...form, [name]: e.target.value })}
          aria-invalid={Boolean(errors[name])}
          aria-describedby={`kandidat-${name}-hint`}
          className="field-input h-11 text-sm disabled:bg-canvas disabled:text-ink-muted"
        />
      )}
      <p id={`kandidat-${name}-hint`} className={errors[name] ? 'field-error' : 'mt-1.5 text-xs text-ink-muted'}>
        {errors[name] ?? props.hint}
      </p>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} dismissible={!save.isPending} labelledBy="form-kandidat-judul" panelClassName="max-w-[680px]">
      <form onSubmit={submit} noValidate className="p-6 sm:p-7">
        <h2 id="form-kandidat-judul" className="text-xl font-extrabold">
          {candidate ? `Edit Kandidat No. ${candidate.candidateNumber} — ${candidate.categoryName}` : 'Tambah Kandidat'}
        </h2>

        <div className="mt-5">
          <label htmlFor="kandidat-kategori" className="field-label">
            Kategori
          </label>
          <select
            id="kandidat-kategori"
            value={form.categoryId}
            disabled={categoryLocked}
            onChange={(e) => {
              const categoryId = e.target.value ? Number(e.target.value) : '';
              setForm({
                ...form,
                categoryId,
                // Nomor urut mengikuti kategori yang dipilih selama menambah kandidat baru.
                candidateNumber: candidate ? form.candidateNumber : String(nextNumberIn(candidates, categoryId)),
              });
            }}
            aria-invalid={Boolean(errors.categoryId)}
            aria-describedby="kandidat-kategori-hint"
            className="field-input h-11 text-sm disabled:bg-canvas disabled:text-ink-muted"
          >
            <option value="">Pilih kategori</option>
            {categories.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
          <p id="kandidat-kategori-hint" className={errors.categoryId ? 'field-error' : 'mt-1.5 text-xs text-ink-muted'}>
            {errors.categoryId ??
              (categoryLocked
                ? 'Kategori tidak dapat diubah setelah kandidat memperoleh suara atau saat pemungutan suara berlangsung.'
                : category
                  ? `Pemilih kategori ini: ${VOTER_SCOPE_LABEL[category.voterScope].toLowerCase()}.`
                  : 'Kategori dikelola di menu Data Kategori.')}
          </p>
        </div>

        <fieldset className="mt-4">
          <legend className="field-label">Kandidat</legend>
          <PersonPicker
            value={form.person}
            onChange={(person) => {
              setForm({ ...form, person });
              if (person) setPersonMissing(false);
            }}
            currentUserId={candidate?.userId}
            categoryId={form.categoryId === '' ? undefined : form.categoryId}
            error={personError}
            disabled={locked}
          />
          <p className={personError ? 'field-error' : 'mt-1.5 text-xs text-ink-muted'}>
            {personError ??
              (locked
                ? 'Orang yang menjadi kandidat tidak dapat diganti selama masa pemungutan suara.'
                : 'Kandidat dapat berupa siswa maupun guru. Nama dan kelas diambil dari data pemilih.')}
          </p>
        </fieldset>

        <div className="mt-4 grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
          {field('candidateNumber', 'Nomor urut', { type: 'number', disabled: locked, hint: 'Unik per kategori.' })}
          {field('vision', 'Visi')}
        </div>
        <div className="mt-4 grid gap-4">
          {field('mission', 'Misi', { multiline: 4, hint: 'Satu misi per baris (1–10 baris).' })}
          {field('programs', 'Program kerja unggulan', { multiline: 3, hint: 'Satu program per baris.' })}
          {field('organizationHistory', 'Riwayat organisasi', { multiline: 3, hint: 'Satu riwayat per baris.' })}
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
          <button type="submit" disabled={save.isPending} className="btn btn-primary h-11 sm:min-w-40">
            {save.isPending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {save.isPending ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PhotoControl({ candidate }: { candidate: AdminCandidate }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const upload = useMutation({
    mutationFn: (file: File | null) => {
      if (!file) return api(`/admin/candidates/${candidate.id}/photo`, { method: 'DELETE' });
      const body = new FormData();
      body.append('photo', file);
      return api(`/admin/candidates/${candidate.id}/photo`, { method: 'POST', body });
    },
    onSuccess: (_data, file) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'candidates'] });
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast(file ? `Foto ${candidate.name} diperbarui.` : `Foto ${candidate.name} dihapus.`, 'success');
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast('Ukuran foto maksimal 3 MB.', 'error');
      return;
    }
    upload.mutate(file);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onFile} tabIndex={-1} aria-hidden />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={upload.isPending} className="btn btn-outline h-9 px-3 text-[13px]">
        {upload.isPending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <ImagePlus aria-hidden className="size-4" />}
        {candidate.photoUrl ? 'Ganti foto' : 'Unggah foto'}
        <span className="sr-only"> {candidate.name}</span>
      </button>
      {candidate.photoUrl && (
        <button type="button" onClick={() => upload.mutate(null)} disabled={upload.isPending} className="btn h-9 px-3 text-[13px] text-ink-muted hover:text-danger">
          Hapus foto<span className="sr-only"> {candidate.name}</span>
        </button>
      )}
    </div>
  );
}

export default function CandidatesPage() {
  const candidates = useAdminCandidates();
  const categories = useAdminCategories();
  const election = useElection();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState<AdminCandidate | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<AdminCandidate | null>(null);

  const inProgress = election.data?.phase === 'active' || election.data?.phase === 'outside_hours';
  const categoryParam = Number(searchParams.get('kategori'));
  const categoryFilter = Number.isInteger(categoryParam) && categoryParam > 0 ? categoryParam : '';
  const list = (candidates.data ?? []).filter((c) => categoryFilter === '' || c.categoryId === categoryFilter);
  const noCategories = categories.data?.length === 0;

  const remove = useMutation({
    mutationFn: (id: number) => api(`/admin/candidates/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'candidates'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast('Kandidat dihapus.', 'success');
      setDeleting(null);
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  return (
    <>
      <AdminPageHeader
        title="Data Kandidat"
        description="Kandidat dipilih dari data siswa atau guru. Atur kategori, nomor urut, visi, misi, program, dan foto yang tampil di halaman publik."
        actions={
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            disabled={noCategories}
            title={noCategories ? 'Tambahkan kategori terlebih dahulu' : undefined}
            className="btn btn-primary h-10"
          >
            <Plus aria-hidden className="size-4" /> Tambah Kandidat
          </button>
        }
      />

      {inProgress && (
        <p className="flex items-start gap-2.5 rounded-card border border-line bg-white px-4 py-3 text-[13px] leading-normal text-ink-body">
          <Info aria-hidden className="mt-px size-4 shrink-0 text-royal" />
          Selama masa pemungutan suara, kandidat tidak dapat ditambah atau dihapus, dan kategori, nomor urut, serta orangnya tidak dapat
          diubah. Perbaikan teks dan foto tetap diizinkan.
        </p>
      )}

      {noCategories && (
        <p className="flex items-start gap-2.5 rounded-card border border-warning-line bg-warning-bg px-4 py-3 text-[13px] leading-normal font-semibold text-warning-ink">
          <Info aria-hidden className="mt-px size-4 shrink-0" />
          Belum ada kategori pemilihan.{' '}
          <Link to="/admin/kategori" className="font-bold underline">
            Tambahkan kategori
          </Link>{' '}
          sebelum mendaftarkan kandidat.
        </p>
      )}

      {categories.data && categories.data.length > 1 && (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="filter-kategori" className="field-label">
              Kategori
            </label>
            <select
              id="filter-kategori"
              value={categoryFilter}
              onChange={(e) => setSearchParams(e.target.value ? { kategori: e.target.value } : {}, { replace: true })}
              className={selectClass}
            >
              <option value="">Semua kategori</option>
              {categories.data.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {candidates.isError && <ErrorNotice message={errorMessage(candidates.error)} onRetry={() => void candidates.refetch()} />}

      <div className="grid gap-4">
        {candidates.isPending &&
          Array.from({ length: 3 }, (_, i) => <div key={i} aria-hidden className="h-40 animate-pulse rounded-panel bg-white" />)}
        {candidates.data && list.length === 0 && !noCategories && (
          <Panel>
            <p className="py-6 text-center text-sm text-ink-muted">
              {categoryFilter === ''
                ? 'Belum ada kandidat. Klik “Tambah Kandidat” untuk memulai.'
                : 'Belum ada kandidat di kategori ini.'}
            </p>
          </Panel>
        )}
        {list.map((candidate) => (
          <article key={candidate.id} className="flex flex-col gap-4 rounded-panel border border-line bg-white p-4 sm:flex-row sm:p-5">
            <div className="relative aspect-[4/5] w-28 shrink-0 overflow-hidden rounded-card border border-line">
              <CandidatePhoto photoUrl={candidate.photoUrl} name={candidate.name} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <CandidateBadge number={candidate.candidateNumber} size="sm" className="shadow-none" />
                <div className="min-w-0">
                  <h2 className="text-[17px] font-extrabold">
                    {candidate.name}
                    <span className={cn('ml-2 rounded-full bg-royal-soft px-2 py-0.5 align-middle text-[11px] font-bold text-royal')}>
                      {candidate.categoryName}
                    </span>
                  </h2>
                  <p className="text-[13px] text-ink-muted">
                    {candidate.role === 'teacher' ? 'Username' : 'NIS'} {candidate.nis} · {personMeta(candidate) || 'Tanpa kelas'}
                  </p>
                </div>
                <div className="flex gap-2 sm:ml-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(candidate);
                      setFormOpen(true);
                    }}
                    className="btn btn-outline h-9 px-3 text-[13px]"
                  >
                    <Pencil aria-hidden className="size-3.5" /> Edit<span className="sr-only"> {candidate.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(candidate)}
                    disabled={candidate.hasVotes}
                    title={candidate.hasVotes ? 'Kandidat yang sudah memperoleh suara tidak dapat dihapus' : undefined}
                    className="btn btn-outline h-9 px-3 text-[13px] hover:border-danger hover:text-danger"
                  >
                    <Trash aria-hidden className="size-3.5" /> Hapus<span className="sr-only"> {candidate.name}</span>
                  </button>
                </div>
              </div>
              <p className="mt-3 line-clamp-2 text-[13px] leading-normal text-ink-body">“{candidate.vision}”</p>
              <p className="mt-1.5 text-xs text-ink-muted">
                {candidate.mission.length} misi · {candidate.programs.length} program · {candidate.organizationHistory.length} riwayat
                organisasi
              </p>
              <div className="mt-3">
                <PhotoControl candidate={candidate} />
                <p className="mt-1.5 text-xs text-ink-muted">Rasio 4:5, JPG/PNG/WEBP, maksimal 3 MB.</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <CandidateFormModal
        candidate={editing}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        candidates={candidates.data ?? []}
        categories={categories.data ?? []}
        defaultCategoryId={categoryFilter}
        identityLocked={inProgress}
      />

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        dismissible={!remove.isPending}
        role="alertdialog"
        labelledBy="hapus-kandidat-judul"
        panelClassName="max-w-[420px] p-6"
      >
        <h2 id="hapus-kandidat-judul" className="text-lg font-extrabold">
          Hapus kandidat?
        </h2>
        <p className="mt-2 text-sm text-ink-body">
          {deleting?.name} (No. {deleting?.candidateNumber} — {deleting?.categoryName}) akan dihapus permanen beserta fotonya.
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
