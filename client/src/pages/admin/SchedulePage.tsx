import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useToast } from '../../components/Toast';
import { AdminPageHeader, ErrorNotice, Panel } from '../../features/admin/AdminUi';
import { useElection } from '../../hooks/queries';
import { api, errorMessage, fieldErrors } from '../../lib/api';
import { cn } from '../../lib/cn';
import { formatDateRange, joinWib, splitWib } from '../../lib/format';
import type { Election, ElectionStatus } from '../../types';

const STATUS_OPTIONS: Array<{ value: ElectionStatus; label: string; description: string }> = [
  { value: 'draft', label: 'Draf', description: 'Belum dibuka. Siswa dapat melihat kandidat tetapi belum bisa memilih.' },
  { value: 'open', label: 'Dibuka', description: 'Siswa dapat memilih sesuai tanggal dan jam di atas.' },
  { value: 'closed', label: 'Ditutup', description: 'Pemungutan suara dihentikan, walau masih dalam jadwal.' },
];

interface FormState {
  electionName: string;
  startDay: string;
  endDay: string;
  openTime: string;
  closeTime: string;
  status: ElectionStatus;
}

function toForm(election: Election): FormState {
  const start = splitWib(election.startDate);
  const end = splitWib(election.endDate);
  return {
    electionName: election.electionName,
    startDay: start.date,
    endDay: end.date,
    openTime: start.time,
    closeTime: end.time,
    status: election.status,
  };
}

function ScheduleForm({ election }: { election: Election }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(() => toForm(election));

  const save = useMutation({
    mutationFn: () =>
      api<{ election: Election }>('/admin/election', {
        method: 'PUT',
        body: {
          electionName: form.electionName,
          startDate: joinWib(form.startDay, form.openTime),
          endDate: joinWib(form.endDay, form.closeTime),
          status: form.status,
        },
      }),
    onSuccess: ({ election: updated }) => {
      queryClient.setQueryData(['election'], updated);
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      setForm(toForm(updated));
      toast('Jadwal voting berhasil disimpan.', 'success');
    },
  });
  const errors = fieldErrors(save.error);
  const continuous = form.openTime >= form.closeTime;
  const ready = form.startDay && form.endDay && form.openTime && form.closeTime;

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <form onSubmit={submit} noValidate className="grid items-start gap-[18px] xl:grid-cols-[minmax(0,1fr)_360px]">
      <Panel title="Pengaturan Jadwal" titleId="jadwal-form">
        <div className="grid gap-4">
          <div>
            <label htmlFor="nama-pemilihan" className="field-label">
              Nama pemilihan
            </label>
            <input
              id="nama-pemilihan"
              value={form.electionName}
              onChange={(e) => set({ electionName: e.target.value })}
              aria-invalid={Boolean(errors.electionName)}
              className="field-input h-11 text-sm"
            />
            {errors.electionName && <p className="field-error">{errors.electionName}</p>}
          </div>

          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="sr-only">Rentang tanggal</legend>
            <div>
              <label htmlFor="tanggal-mulai" className="field-label">
                Tanggal mulai
              </label>
              <input id="tanggal-mulai" type="date" value={form.startDay} onChange={(e) => set({ startDay: e.target.value })} className="field-input h-11 text-sm" />
            </div>
            <div>
              <label htmlFor="tanggal-selesai" className="field-label">
                Tanggal selesai
              </label>
              <input id="tanggal-selesai" type="date" value={form.endDay} min={form.startDay} onChange={(e) => set({ endDay: e.target.value })} className="field-input h-11 text-sm" />
            </div>
          </fieldset>

          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="sr-only">Jam pemungutan suara (WIB)</legend>
            <div>
              <label htmlFor="jam-buka" className="field-label">
                Jam buka (WIB)
              </label>
              <input id="jam-buka" type="time" value={form.openTime} onChange={(e) => set({ openTime: e.target.value })} className="field-input h-11 text-sm" />
            </div>
            <div>
              <label htmlFor="jam-tutup" className="field-label">
                Jam tutup (WIB)
              </label>
              <input id="jam-tutup" type="time" value={form.closeTime} onChange={(e) => set({ closeTime: e.target.value })} className="field-input h-11 text-sm" />
            </div>
          </fieldset>
          {errors.endDate && <p className="field-error -mt-2">{errors.endDate}</p>}

          <fieldset>
            <legend className="field-label">Status</legend>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {STATUS_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    'cursor-pointer rounded-card border p-3.5 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-royal',
                    form.status === option.value ? 'border-royal bg-royal-soft' : 'border-line-strong hover:border-ink-subtle',
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <input
                      type="radio"
                      name="status"
                      value={option.value}
                      checked={form.status === option.value}
                      onChange={() => set({ status: option.value })}
                      className="size-4 accent-royal"
                    />
                    {option.label}
                  </span>
                  <span className="mt-1 block text-xs leading-normal text-ink-muted">{option.description}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {save.isError && !Object.keys(errors).length && <ErrorNotice message={errorMessage(save.error)} />}

          <div className="flex justify-end">
            <button type="submit" disabled={save.isPending || !ready} className="btn btn-primary h-11 min-w-40">
              {save.isPending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
              {save.isPending ? 'Menyimpan…' : 'Simpan Jadwal'}
            </button>
          </div>
        </div>
      </Panel>

      <Panel title="Ringkasan untuk Siswa" titleId="jadwal-ringkasan">
        {ready ? (
          <div className="text-sm leading-relaxed text-ink-body">
            <p>
              <span className="font-bold text-ink">{formatDateRange(joinWib(form.startDay, form.openTime), joinWib(form.endDay, form.closeTime))}</span>
            </p>
            <p className="mt-1">
              {continuous ? (
                <>
                  Dibuka terus-menerus mulai <strong className="text-ink">{form.openTime}</strong> pada hari pertama hingga{' '}
                  <strong className="text-ink">{form.closeTime} WIB</strong> pada hari terakhir.
                </>
              ) : (
                <>
                  Dibuka setiap hari pukul{' '}
                  <strong className="text-ink">
                    {form.openTime} – {form.closeTime} WIB
                  </strong>
                  .
                </>
              )}
            </p>
            <p className="mt-3 rounded-control bg-canvas px-3 py-2.5 text-[13px] text-ink-muted">
              Server memeriksa jadwal ini di setiap suara yang masuk. Suara di luar jadwal ditolak dan tercatat di audit log.
            </p>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">Lengkapi tanggal dan jam untuk melihat ringkasan.</p>
        )}
      </Panel>
    </form>
  );
}

export default function SchedulePage() {
  const election = useElection();
  return (
    <>
      <AdminPageHeader title="Jadwal Voting" />
      {election.isError && <ErrorNotice message={errorMessage(election.error)} onRetry={() => void election.refetch()} />}
      {election.data ? (
        <ScheduleForm key={election.data.startDate + election.data.endDate + election.data.status} election={election.data} />
      ) : (
        !election.isError && <div aria-hidden className="h-80 animate-pulse rounded-panel bg-white" />
      )}
    </>
  );
}
