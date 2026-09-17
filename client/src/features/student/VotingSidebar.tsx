import { CalendarDays, CircleAlert, CircleCheck, Clock, Eye } from 'lucide-react';
import { Link } from 'react-router';
import { PHASE_INFO, TONE_BADGE } from '../../lib/election';
import { cn } from '../../lib/cn';
import { formatDateRange, formatTimeRange } from '../../lib/format';
import type { Election } from '../../types';

const STEPS = [
  'Login menggunakan akun siswa.',
  'Pilih salah satu kandidat.',
  'Periksa kembali pilihan Anda.',
  'Konfirmasi suara.',
  'Selesai.',
];

interface VotingSidebarProps {
  election: Election | undefined;
  hasVoted: boolean;
  isPreview: boolean;
}

export function VotingSidebar({ election, hasVoted, isPreview }: VotingSidebarProps) {
  const phase = election ? PHASE_INFO[election.phase] : null;

  let status: { text: string; hint: string; tone: 'done' | 'pending' };
  if (isPreview) {
    status = { text: 'Mode pratinjau panitia', hint: 'Akun panitia tidak dapat memberikan suara.', tone: 'pending' };
  } else if (hasVoted) {
    status = {
      text: 'Anda sudah memberikan suara',
      hint: 'Terima kasih telah berpartisipasi. Pilihan tidak dapat diubah.',
      tone: 'done',
    };
  } else {
    status = {
      text: 'Anda belum memberikan suara',
      hint:
        !election || election.isVotingOpen
          ? 'Pilih salah satu kandidat sebelum masa pemungutan suara ditutup.'
          : PHASE_INFO[election.phase].message,
      tone: 'pending',
    };
  }

  return (
    <aside aria-label="Informasi pemungutan suara" className="grid content-start items-start gap-4 md:grid-cols-2 xl:grid-cols-1">
      <section aria-labelledby="jadwal-title" className="rounded-card border border-line bg-white p-[18px]">
        <div className="mb-3.5 flex items-center gap-2.5">
          <span aria-hidden className="flex size-[34px] items-center justify-center rounded-button bg-royal-soft text-royal">
            <CalendarDays className="size-[18px]" />
          </span>
          <h2 id="jadwal-title" className="text-[15px] font-extrabold">
            Jadwal Pemungutan Suara
          </h2>
        </div>
        {election ? (
          <dl className="flex flex-col gap-2.5 text-sm">
            <div className="flex justify-between gap-2.5">
              <dt className="flex items-center gap-1.5 text-ink-muted">
                <CalendarDays aria-hidden className="size-3.5" /> Tanggal
              </dt>
              <dd className="text-right font-bold">{formatDateRange(election.startDate, election.endDate)}</dd>
            </div>
            <div className="flex justify-between gap-2.5">
              <dt className="flex items-center gap-1.5 text-ink-muted">
                <Clock aria-hidden className="size-3.5" /> Waktu
              </dt>
              <dd className="text-right font-bold">{formatTimeRange(election.startDate, election.endDate)}</dd>
            </div>
          </dl>
        ) : (
          <div aria-hidden className="space-y-2.5">
            <div className="h-4 animate-pulse rounded bg-line-soft" />
            <div className="h-4 animate-pulse rounded bg-line-soft" />
          </div>
        )}
      </section>

      <section aria-labelledby="status-title" aria-live="polite" className="rounded-card border border-line bg-white p-[18px]">
        <div className="mb-3 flex items-center gap-2.5">
          <h2 id="status-title" className="text-[15px] font-extrabold">
            Status Voting
          </h2>
          {phase && (
            <span className={cn('ml-auto rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-[0.06em] uppercase', TONE_BADGE[phase.tone])}>
              {phase.label}
            </span>
          )}
        </div>
        <p
          className={cn(
            'flex items-center gap-2 text-[15px] font-bold',
            status.tone === 'done' ? 'text-success-ink' : 'text-warning-ink',
          )}
        >
          {isPreview ? (
            <Eye aria-hidden className="size-[18px] shrink-0" />
          ) : status.tone === 'done' ? (
            <CircleCheck aria-hidden className="size-[18px] shrink-0" />
          ) : (
            <CircleAlert aria-hidden className="size-[18px] shrink-0" />
          )}
          {status.text}
        </p>
        <p className="mt-1.5 text-[13px] leading-normal text-ink-muted">{status.hint}</p>
        {hasVoted && !isPreview && (
          <Link to="/voting/berhasil" className="mt-2.5 inline-block text-[13px] font-bold text-royal hover:text-navy-hover">
            Lihat bukti suara
          </Link>
        )}
      </section>

      <section id="tatacara" aria-labelledby="tatacara-title" className="scroll-mt-24 rounded-card border border-line bg-white p-[18px]">
        <h2 id="tatacara-title" className="mb-3.5 text-[15px] font-extrabold">
          Tata Cara Voting
        </h2>
        <ol className="flex flex-col gap-3">
          {STEPS.map((step, index) => (
            <li key={step} className="flex items-start gap-2.5">
              <span
                aria-hidden
                className={cn(
                  'flex size-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white',
                  index === STEPS.length - 1 ? 'bg-success-ink' : 'bg-navy',
                )}
              >
                {index + 1}
              </span>
              <span className="text-[13px] leading-normal text-ink-body">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <div role="note" className="flex gap-3 rounded-card border border-danger-line bg-danger-bg p-4">
        <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-danger text-sm font-extrabold text-white">
          !
        </span>
        <p className="text-[13px] leading-normal font-semibold text-danger-ink">
          Setiap siswa hanya dapat memilih satu kali. Pastikan pilihan Anda sudah benar sebelum konfirmasi.
        </p>
      </div>
    </aside>
  );
}
