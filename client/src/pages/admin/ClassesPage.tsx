import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Pencil, Plus, Trash, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { AdminPageHeader, ErrorNotice, Panel, selectClass } from '../../features/admin/AdminUi';
import { GRADE_FILTER_OPTIONS, matchesGrade, type GradeFilter } from '../../features/admin/ClassSelect';
import { useClasses } from '../../hooks/admin';
import { api, errorMessage, fieldErrors } from '../../lib/api';
import { formatNumber, formatPercent } from '../../lib/format';
import { detectGradeLevel, gradeLabel, GRADE_OPTIONS } from '../../lib/grade';
import type { GradeLevel, SchoolClass } from '../../types';

function invalidateClassData(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['admin', 'classes'] });
  void queryClient.invalidateQueries({ queryKey: ['admin', 'students'] });
  void queryClient.invalidateQueries({ queryKey: ['admin', 'candidates'] });
  void queryClient.invalidateQueries({ queryKey: ['candidates'] });
}

function ClassFormModal({ schoolClass, open, onClose }: { schoolClass: SchoolClass | null; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [grade, setGrade] = useState<GradeLevel | null>(null);
  const [gradeTouched, setGradeTouched] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);

  const key = open ? String(schoolClass?.id ?? 'baru') : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (key) {
      setName(schoolClass?.name ?? '');
      setGrade(schoolClass?.gradeLevel ?? null);
      setGradeTouched(Boolean(schoolClass));
    }
  }

  const save = useMutation({
    mutationFn: () => {
      const body = { name, gradeLevel: grade };
      return schoolClass
        ? api(`/admin/classes/${schoolClass.id}`, { method: 'PUT', body })
        : api('/admin/classes', { method: 'POST', body });
    },
    onSuccess: () => {
      invalidateClassData(queryClient);
      toast(schoolClass ? 'Data kelas diperbarui.' : 'Kelas ditambahkan.', 'success');
      onClose();
    },
  });
  const errors = fieldErrors(save.error);

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <Modal open={open} onClose={onClose} dismissible={!save.isPending} labelledBy="form-kelas-judul" panelClassName="max-w-[440px]">
      <form onSubmit={submit} noValidate className="p-6 sm:p-7">
        <h2 id="form-kelas-judul" className="text-xl font-extrabold">
          {schoolClass ? 'Edit Kelas' : 'Tambah Kelas'}
        </h2>
        <div className="mt-5 grid gap-4">
          <div>
            <label htmlFor="kelas-nama" className="field-label">
              Nama kelas
            </label>
            <input
              id="kelas-nama"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                // Tingkat mengikuti nama selama belum diubah manual.
                if (!gradeTouched) setGrade(detectGradeLevel(e.target.value));
              }}
              aria-invalid={Boolean(errors.name)}
              aria-describedby="kelas-nama-hint"
              autoComplete="off"
              className="field-input h-11 text-sm"
            />
            <p id="kelas-nama-hint" className={errors.name ? 'field-error' : 'mt-1.5 text-xs text-ink-muted'}>
              {errors.name ?? 'Contoh: X-1, XI IPA 2, XII IPS 1.'}
            </p>
          </div>
          <div>
            <label htmlFor="kelas-tingkat" className="field-label">
              Tingkat
            </label>
            <select
              id="kelas-tingkat"
              value={grade ?? ''}
              onChange={(e) => {
                setGradeTouched(true);
                setGrade(e.target.value ? (Number(e.target.value) as GradeLevel) : null);
              }}
              className="field-input h-11 text-sm"
            >
              {GRADE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  Kelas {option.label}
                </option>
              ))}
              <option value="">Lainnya</option>
            </select>
            {schoolClass && schoolClass.studentCount > 0 && (
              <p className="mt-1.5 text-xs text-ink-muted">
                Perubahan berlaku untuk {formatNumber(schoolClass.studentCount)} siswa di kelas ini.
              </p>
            )}
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
          <button type="submit" disabled={save.isPending} className="btn btn-primary h-11 sm:min-w-32">
            {save.isPending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {save.isPending ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function ClassesPage() {
  const classes = useClasses();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [grade, setGrade] = useState<GradeFilter>('');
  const [editing, setEditing] = useState<SchoolClass | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<SchoolClass | null>(null);

  const remove = useMutation({
    mutationFn: (id: number) => api(`/admin/classes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidateClassData(queryClient);
      toast('Kelas dihapus.', 'success');
      setDeleting(null);
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const term = search.trim().toLowerCase();
  const visible = (classes.data ?? []).filter((c) => matchesGrade(c.gradeLevel, grade) && c.name.toLowerCase().includes(term));
  const totalStudents = visible.reduce((sum, c) => sum + c.studentCount, 0);

  return (
    <>
      <AdminPageHeader
        title="Data Kelas"
        description="Daftar kelas dan partisipasi per kelas. Nama kelas siswa otomatis mengikuti perubahan di sini."
        actions={
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="btn btn-primary h-10"
          >
            <Plus aria-hidden className="size-4" /> Tambah Kelas
          </button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1 sm:max-w-xs">
          <label htmlFor="cari-kelas" className="field-label">
            Cari kelas
          </label>
          <input id="cari-kelas" type="search" value={search} onChange={(e) => setSearch(e.target.value)} className="field-input h-10 text-sm" />
        </div>
        <div>
          <label htmlFor="filter-tingkat-kelas" className="field-label">
            Tingkat
          </label>
          <select id="filter-tingkat-kelas" value={grade} onChange={(e) => setGrade(e.target.value as GradeFilter)} className={selectClass}>
            {GRADE_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {classes.data && (
          <p className="pb-2.5 text-[13px] text-ink-muted sm:ml-auto">
            {formatNumber(visible.length)} kelas · {formatNumber(totalStudents)} siswa
          </p>
        )}
      </div>

      <Panel>
        {classes.isError ? (
          <ErrorNotice message={errorMessage(classes.error)} onRetry={() => void classes.refetch()} />
        ) : !classes.data ? (
          <div aria-hidden className="h-64 animate-pulse rounded-card bg-line-soft" />
        ) : visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">
            {classes.data.length === 0
              ? 'Belum ada kelas. Tambahkan kelas atau impor data siswa — kelas dapat dibuat otomatis saat impor.'
              : 'Tidak ada kelas yang cocok dengan filter.'}
          </p>
        ) : (
          <div className="-mx-1 table-scroll px-1">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <caption className="sr-only">Daftar kelas</caption>
              <thead>
                <tr className="border-b border-line-soft text-[11px] tracking-[0.06em] text-ink-muted uppercase">
                  <th scope="col" className="pb-2.5 font-extrabold">Kelas</th>
                  <th scope="col" className="pb-2.5 font-extrabold">Tingkat</th>
                  <th scope="col" className="pb-2.5 text-right font-extrabold">Siswa</th>
                  <th scope="col" className="w-[30%] pb-2.5 pl-6 font-extrabold">Sudah memilih</th>
                  <th scope="col" className="pb-2.5 text-right font-extrabold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => {
                  const turnout = c.studentCount ? Math.round((c.votedCount / c.studentCount) * 1000) / 10 : 0;
                  return (
                    <tr key={c.id} className="border-b border-canvas last:border-0">
                      <td className="py-3 pr-3 font-bold">{c.name}</td>
                      <td className="py-3 pr-3 text-ink-body">{gradeLabel(c.gradeLevel)}</td>
                      <td className="py-3 text-right tabular-nums">{formatNumber(c.studentCount)}</td>
                      <td className="py-3 pl-6">
                        <div className="flex items-center gap-3">
                          <div aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-royal-soft">
                            <div className="h-full rounded-full bg-royal" style={{ width: `${turnout}%` }} />
                          </div>
                          <span className="w-24 text-right text-[13px] text-ink-body tabular-nums">
                            {formatNumber(c.votedCount)} · {formatPercent(turnout)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <Link to={`/admin/siswa?classId=${c.id}`} className="btn h-9 px-2.5 text-[13px] text-royal hover:bg-royal-soft">
                          <Users aria-hidden className="size-3.5" /> Siswa<span className="sr-only"> kelas {c.name}</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(c);
                            setFormOpen(true);
                          }}
                          className="btn h-9 px-2.5 text-[13px] text-royal hover:bg-royal-soft"
                        >
                          <Pencil aria-hidden className="size-3.5" /> Edit<span className="sr-only"> kelas {c.name}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(c)}
                          disabled={c.studentCount > 0}
                          title={c.studentCount > 0 ? 'Kelas yang masih berisi siswa tidak dapat dihapus' : undefined}
                          className="btn h-9 px-2.5 text-[13px] text-ink-muted hover:bg-danger-bg hover:text-danger-ink"
                        >
                          <Trash aria-hidden className="size-3.5" /> Hapus<span className="sr-only"> kelas {c.name}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <ClassFormModal schoolClass={editing} open={formOpen} onClose={() => setFormOpen(false)} />

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        dismissible={!remove.isPending}
        role="alertdialog"
        labelledBy="hapus-kelas-judul"
        panelClassName="max-w-[420px] p-6"
      >
        <h2 id="hapus-kelas-judul" className="text-lg font-extrabold">
          Hapus kelas?
        </h2>
        <p className="mt-2 text-sm text-ink-body">Kelas {deleting?.name} akan dihapus. Kelas ini tidak memiliki siswa.</p>
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
