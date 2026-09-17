import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, LoaderCircle } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useToast } from '../../components/Toast';
import { AdminPageHeader, ErrorNotice, Panel } from '../../features/admin/AdminUi';
import { useElection } from '../../hooks/queries';
import { api, errorMessage, fieldErrors } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import type { Election } from '../../types';

function HeroPhotoSettings() {
  const election = useElection();
  const queryClient = useQueryClient();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: (file: File | null) => {
      if (!file) return api<{ election: Election }>('/admin/election/hero-photo', { method: 'DELETE' });
      const body = new FormData();
      body.append('photo', file);
      return api<{ election: Election }>('/admin/election/hero-photo', { method: 'POST', body });
    },
    onSuccess: ({ election: updated }, file) => {
      queryClient.setQueryData(['election'], updated);
      toast(file ? 'Foto gedung sekolah diperbarui.' : 'Foto gedung sekolah dihapus.', 'success');
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) upload.mutate(file);
  }

  const photoUrl = election.data?.heroPhotoUrl;
  return (
    <Panel title="Foto Gedung Sekolah" titleId="pengaturan-foto" description="Tampil di banner halaman siswa. Disarankan foto landscape minimal 1600 px, maksimal 3 MB (JPG/PNG/WEBP).">
      <div className="relative aspect-[16/6] overflow-hidden rounded-card border border-line bg-navy">
        {photoUrl ? (
          <img src={photoUrl} alt="Foto gedung sekolah saat ini" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-stripes-navy">
            <span className="rounded-md border border-dashed border-white/35 px-3.5 py-2 font-mono text-xs tracking-[0.1em] text-white/70">
              belum ada foto
            </span>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={onFile} />
      <div className="mt-4 flex flex-wrap gap-2.5">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={upload.isPending} className="btn btn-primary h-10">
          {upload.isPending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <ImagePlus aria-hidden className="size-4" />}
          {photoUrl ? 'Ganti foto' : 'Unggah foto'}
        </button>
        {photoUrl && (
          <button type="button" onClick={() => upload.mutate(null)} disabled={upload.isPending} className="btn btn-outline h-10">
            Hapus foto
          </button>
        )}
      </div>
    </Panel>
  );
}

function PasswordSettings() {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [mismatch, setMismatch] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      api('/admin/account/password', {
        method: 'PUT',
        body: { currentPassword: form.currentPassword, newPassword: form.newPassword },
      }),
    onSuccess: () => {
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      toast('Kata sandi berhasil diperbarui. Sesi di perangkat lain telah dikeluarkan.', 'success');
    },
  });
  const errors = fieldErrors(save.error);

  function submit(event: FormEvent) {
    event.preventDefault();
    const different = form.newPassword !== form.confirm;
    setMismatch(different);
    if (!different) save.mutate();
  }

  const fields = [
    { name: 'currentPassword', label: 'Kata sandi saat ini', autoComplete: 'current-password', error: errors.currentPassword },
    { name: 'newPassword', label: 'Kata sandi baru', autoComplete: 'new-password', error: errors.newPassword ?? 'Minimal 10 karakter.' },
    { name: 'confirm', label: 'Ulangi kata sandi baru', autoComplete: 'new-password', error: mismatch ? 'Konfirmasi kata sandi tidak sama.' : undefined },
  ] as const;

  return (
    <Panel title="Kata Sandi Panitia" titleId="pengaturan-sandi" description="Mengganti kata sandi akan mengeluarkan akun ini dari perangkat lain.">
      <form onSubmit={submit} noValidate className="grid gap-4">
        {fields.map((field) => {
          const isError = field.name === 'newPassword' ? Boolean(errors.newPassword) : Boolean(field.error);
          return (
            <div key={field.name}>
              <label htmlFor={`sandi-${field.name}`} className="field-label">
                {field.label}
              </label>
              <input
                id={`sandi-${field.name}`}
                type="password"
                autoComplete={field.autoComplete}
                value={form[field.name]}
                onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                aria-invalid={isError}
                aria-describedby={field.error ? `sandi-${field.name}-hint` : undefined}
                className="field-input h-11 text-sm"
              />
              {field.error && (
                <p id={`sandi-${field.name}-hint`} className={isError ? 'field-error' : 'mt-1.5 text-xs text-ink-muted'}>
                  {field.error}
                </p>
              )}
            </div>
          );
        })}
        {save.isError && !Object.keys(errors).length && <ErrorNotice message={errorMessage(save.error)} />}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={save.isPending || !form.currentPassword || !form.newPassword}
            className="btn btn-primary h-11 min-w-40"
          >
            {save.isPending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {save.isPending ? 'Menyimpan…' : 'Ubah Kata Sandi'}
          </button>
        </div>
      </form>
    </Panel>
  );
}

export default function SettingsPage() {
  const election = useElection();
  return (
    <>
      <AdminPageHeader title="Pengaturan Sistem" description="Tampilan halaman siswa dan keamanan akun panitia." />
      {election.isError && <ErrorNotice message={errorMessage(election.error)} />}
      <div className="grid items-start gap-[18px] xl:grid-cols-2">
        <HeroPhotoSettings />
        <div className="grid gap-[18px]">
          <PasswordSettings />
          <Panel title="Informasi Sistem" titleId="pengaturan-info">
            <dl className="grid gap-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Zona waktu</dt>
                <dd className="font-bold">WIB (Asia/Jakarta)</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Waktu server</dt>
                <dd className="font-bold">{election.data ? formatDateTime(election.data.serverTime) : '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Kerahasiaan suara</dt>
                <dd className="text-right font-bold">Panel hanya menampilkan agregat</dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}
