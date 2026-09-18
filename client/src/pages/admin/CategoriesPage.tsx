import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, Contact, LoaderCircle, Lock, Pencil, Plus, Trash } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { AdminPageHeader, ErrorNotice, Panel, TableSwipeHint } from '../../features/admin/AdminUi';
import { useAdminCategories } from '../../hooks/admin';
import { useElection } from '../../hooks/queries';
import { api, errorMessage, fieldErrors } from '../../lib/api';
import { formatNumber } from '../../lib/format';
import { VOTER_SCOPE_LABEL } from '../../lib/voting';
import type { AdminCategory, VoterScope } from '../../types';

const SCOPE_OPTIONS: Array<{ value: VoterScope; label: string; hint: string }> = [
  {
    value: 'all',
    label: 'Siswa & guru',
    hint: 'Semua pemilih terdaftar dapat memilih di kategori ini.',
  },
  {
    value: 'student',
    label: 'Khusus siswa',
    hint: 'Hanya siswa yang dapat memilih, mis. kategori guru favorit.',
  },
  {
    value: 'teacher',
    label: 'Khusus guru',
    hint: 'Hanya guru yang dapat memilih.',
  },
];

function invalidateCategories(queryClient: ReturnType<typeof useQueryClient>) {
  for (const key of ['categories', 'candidates', 'stats', 'results']) {
    void queryClient.invalidateQueries({ queryKey: ['admin', key] });
  }
  void queryClient.invalidateQueries({ queryKey: ['categories'] });
}

function CategoryFormModal({ category, open, onClose }: { category: AdminCategory | null; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    name: '',
    description: '',
    voterScope: 'all' as VoterScope,
    sortOrder: 0,
  });
  const [lastKey, setLastKey] = useState<string | null>(null);

  const key = open ? String(category?.id ?? 'baru') : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (key) {
      setForm({
        name: category?.name ?? '',
        description: category?.description ?? '',
        voterScope: category?.voterScope ?? 'all',
        sortOrder: category?.sortOrder ?? 0,
      });
    }
  }

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, description: form.description.trim() || null };
      return category
        ? api(`/admin/categories/${category.id}`, { method: 'PUT', body })
        : api('/admin/categories', { method: 'POST', body });
    },
    onSuccess: () => {
      invalidateCategories(queryClient);
      toast(category ? 'Kategori diperbarui.' : 'Kategori ditambahkan.', 'success');
      onClose();
    },
  });
  const errors = fieldErrors(save.error);

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <Modal open={open} onClose={onClose} dismissible={!save.isPending} labelledBy="form-kategori-judul" panelClassName="max-w-[520px]">
      <form onSubmit={submit} noValidate className="p-6 sm:p-7">
        <h2 id="form-kategori-judul" className="text-xl font-extrabold">
          {category ? 'Edit Kategori' : 'Tambah Kategori'}
        </h2>
        <div className="mt-5 grid gap-4">
          <div>
            <label htmlFor="kategori-nama" className="field-label">
              Nama kategori
            </label>
            <input
              id="kategori-nama"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              aria-invalid={Boolean(errors.name)}
              aria-describedby="kategori-nama-hint"
              autoComplete="off"
              className="field-input h-11 text-sm"
            />
            <p id="kategori-nama-hint" className={errors.name ? 'field-error' : 'mt-1.5 text-xs text-ink-muted'}>
              {errors.name ?? 'Contoh: Ketua OSIS, Ketua MPK, Guru Favorit.'}
            </p>
          </div>
          <div>
            <label htmlFor="kategori-deskripsi" className="field-label">
              Deskripsi <span className="font-normal text-ink-muted">(opsional)</span>
            </label>
            <textarea
              id="kategori-deskripsi"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              maxLength={300}
              aria-invalid={Boolean(errors.description)}
              aria-describedby="kategori-deskripsi-hint"
              className="field-input py-2.5 text-sm"
            />
            <p id="kategori-deskripsi-hint" className={errors.description ? 'field-error' : 'mt-1.5 text-xs text-ink-muted'}>
              {errors.description ?? 'Tampil di halaman kandidat untuk menjelaskan kategori ini.'}
            </p>
          </div>
          <fieldset>
            <legend className="field-label">Siapa yang boleh memilih</legend>
            <div className="mt-1 grid gap-2">
              {SCOPE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-2.5 rounded-control border border-line px-3.5 py-2.5 text-sm has-[:checked]:border-royal has-[:checked]:bg-royal-soft"
                >
                  <input
                    type="radio"
                    name="voterScope"
                    value={option.value}
                    checked={form.voterScope === option.value}
                    onChange={() => setForm({ ...form, voterScope: option.value })}
                    className="mt-0.5 size-4 accent-royal"
                  />
                  <span>
                    <span className="block font-bold">{option.label}</span>
                    <span className="block text-xs text-ink-muted">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            {errors.voterScope && <p className="field-error">{errors.voterScope}</p>}
            {category && category.voteCount > 0 && (
              <p className="mt-1.5 text-xs text-ink-muted">Hak memilih tidak dapat diubah selama pemungutan suara berlangsung.</p>
            )}
          </fieldset>
          <div>
            <label htmlFor="kategori-urutan" className="field-label">
              Urutan tampil
            </label>
            <input
              id="kategori-urutan"
              type="number"
              min={0}
              max={999}
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
              aria-invalid={Boolean(errors.sortOrder)}
              aria-describedby="kategori-urutan-hint"
              className="field-input h-11 w-28 text-sm"
            />
            <p id="kategori-urutan-hint" className={errors.sortOrder ? 'field-error' : 'mt-1.5 text-xs text-ink-muted'}>
              {errors.sortOrder ?? 'Angka lebih kecil tampil lebih dulu.'}
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

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const categories = useAdminCategories();
  const election = useElection().data;
  const inProgress = election ? election.phase === 'active' || election.phase === 'outside_hours' : false;

  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<AdminCategory | null>(null);

  const remove = useMutation({
    mutationFn: (id: number) => api(`/admin/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidateCategories(queryClient);
      toast('Kategori dihapus.', 'success');
      setDeleting(null);
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  return (
    <>
      <AdminPageHeader
        title="Data Kategori"
        description="Kategori pemilihan, mis. Ketua OSIS dan Ketua MPK. Setiap pemilih hanya dapat memilih satu kali di tiap kategori."
        actions={
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            disabled={inProgress}
            title={inProgress ? 'Kategori tidak dapat ditambah selama pemungutan suara berlangsung' : undefined}
            className="btn btn-primary h-10"
          >
            <Plus aria-hidden className="size-4" /> Tambah Kategori
          </button>
        }
      />

      {inProgress && (
        <p className="flex items-start gap-2 rounded-card border border-warning-line bg-warning-bg px-4 py-3 text-[13px] leading-normal font-semibold text-warning-ink">
          <Lock aria-hidden className="mt-px size-4 shrink-0" />
          Pemungutan suara sedang berlangsung. Kategori tidak dapat ditambah, dihapus, atau diubah hak memilihnya agar suara yang sudah
          masuk tetap sah.
        </p>
      )}

      <Panel>
        {categories.isError ? (
          <ErrorNotice message={errorMessage(categories.error)} onRetry={() => void categories.refetch()} />
        ) : !categories.data ? (
          <div aria-hidden className="h-52 animate-pulse rounded-card bg-line-soft" />
        ) : categories.data.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">
            Belum ada kategori. Tambahkan minimal satu kategori sebelum mendaftarkan kandidat.
          </p>
        ) : (
          <>
            <TableSwipeHint />
            <div className="-mx-1 table-scroll px-1">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <caption className="sr-only">Daftar kategori pemilihan</caption>
                <thead>
                  <tr className="border-b border-line-soft text-[11px] tracking-[0.06em] text-ink-muted uppercase">
                    <th scope="col" className="pb-2.5 font-extrabold">
                      Urutan
                    </th>
                    <th scope="col" className="pb-2.5 font-extrabold">
                      Kategori
                    </th>
                    <th scope="col" className="pb-2.5 font-extrabold">
                      Pemilih
                    </th>
                    <th scope="col" className="pb-2.5 font-extrabold">
                      Kandidat
                    </th>
                    <th scope="col" className="pb-2.5 font-extrabold">
                      Suara masuk
                    </th>
                    <th scope="col" className="pb-2.5 text-right font-extrabold">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {categories.data.map((category) => (
                    <tr key={category.id} className="border-b border-canvas last:border-0">
                      <td className="py-3 pr-3 text-ink-muted">{category.sortOrder}</td>
                      <td className="py-3 pr-3">
                        <span className="font-bold">{category.name}</span>
                        {category.description && <span className="mt-0.5 block text-[13px] text-ink-muted">{category.description}</span>}
                      </td>
                      <td className="py-3 pr-3 text-ink-body">{VOTER_SCOPE_LABEL[category.voterScope]}</td>
                      <td className="py-3 pr-3">
                        <Link
                          to={`/admin/kandidat?kategori=${category.id}`}
                          className="inline-flex items-center gap-1.5 py-1.5 font-bold text-royal hover:text-navy-hover"
                        >
                          <Contact aria-hidden className="size-3.5" /> {formatNumber(category.candidateCount)}
                        </Link>
                      </td>
                      <td className="py-3 pr-3 text-ink-body">{formatNumber(category.voteCount)}</td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(category);
                            setFormOpen(true);
                          }}
                          className="btn h-9 px-2.5 text-[13px] text-royal hover:bg-royal-soft"
                        >
                          <Pencil aria-hidden className="size-3.5" /> Edit
                          <span className="sr-only"> kategori {category.name}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(category)}
                          disabled={inProgress || category.voteCount > 0 || category.candidateCount > 0}
                          title={
                            inProgress
                              ? 'Tidak dapat dihapus selama pemungutan suara berlangsung'
                              : category.voteCount > 0
                                ? 'Kategori yang sudah memiliki suara tidak dapat dihapus'
                                : category.candidateCount > 0
                                  ? 'Hapus kandidat di kategori ini terlebih dahulu'
                                  : undefined
                          }
                          className="btn h-9 px-2.5 text-[13px] text-ink-muted hover:bg-danger-bg hover:text-danger-ink"
                        >
                          <Trash aria-hidden className="size-3.5" /> Hapus
                          <span className="sr-only"> kategori {category.name}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      <CategoryFormModal category={editing} open={formOpen} onClose={() => setFormOpen(false)} />

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        dismissible={!remove.isPending}
        role="alertdialog"
        labelledBy="hapus-kategori-judul"
        panelClassName="max-w-[420px] p-6"
      >
        <h2 id="hapus-kategori-judul" className="flex items-center gap-2 text-lg font-extrabold">
          <CircleAlert aria-hidden className="size-5 text-danger" /> Hapus kategori?
        </h2>
        <p className="mt-2 text-sm text-ink-body">
          Kategori {deleting?.name} akan dihapus dari halaman publik dan tidak dapat dipilih lagi.
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
