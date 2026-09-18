import { LoaderCircle, TriangleAlert, X } from 'lucide-react';
import { useRef, type RefObject } from 'react';
import { CandidateBadge, CandidatePhoto } from '../../components/CandidateVisuals';
import { Modal } from '../../components/Modal';
import { personMeta } from '../../lib/voting';
import type { Candidate } from '../../types';

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="eyebrow text-ink-muted">{title}</h3>
      {children}
    </section>
  );
}

interface CandidateDetailModalProps {
  candidate: Candidate | undefined;
  open: boolean;
  onClose: () => void;
  onPick: (candidate: Candidate) => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}

export function CandidateDetailModal({ candidate, open, onClose, onPick, returnFocusRef }: CandidateDetailModalProps) {
  if (!candidate) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="detail-kandidat-judul"
      returnFocusRef={returnFocusRef}
      panelClassName="max-w-[860px]"
    >
      <div className="grid md:grid-cols-[300px_minmax(0,1fr)]">
        <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[380px]">
          <CandidatePhoto photoUrl={candidate.photoUrl} name={candidate.name} className="md:absolute md:inset-0" />
          <CandidateBadge number={candidate.candidateNumber} size="xl" className="absolute top-4 left-4" />
        </div>
        <div className="p-6 md:px-[30px] md:pt-7 md:pb-[30px]">
          <div className="flex items-start gap-4">
            <div className="min-w-0">
              <p className="eyebrow text-royal">{candidate.categoryName}</p>
              <h2 id="detail-kandidat-judul" className="text-[22px] font-extrabold sm:text-[25px]">
                {candidate.name}
              </h2>
              <p className="mt-1.5 text-sm text-ink-muted">
                Kandidat No. {candidate.candidateNumber} · {personMeta(candidate)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup detail kandidat"
              className="ml-auto flex size-[34px] shrink-0 items-center justify-center rounded-button border border-line bg-white text-ink-muted transition-colors hover:border-ink-subtle hover:text-ink"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>

          <DetailSection title="Visi">
            <p className="mt-2 text-[15px] leading-relaxed text-pretty">{candidate.vision}</p>
          </DetailSection>

          {candidate.mission.length > 0 && (
            <DetailSection title="Misi">
              <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-normal text-ink-body marker:text-ink-subtle">
                {candidate.mission.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </DetailSection>
          )}

          {candidate.programs.length > 0 && (
            <DetailSection title="Program Kerja Unggulan">
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {candidate.programs.map((program) => (
                  <li key={program} className="rounded-full border border-line bg-canvas px-3 py-[7px] text-[13px] font-semibold">
                    {program}
                  </li>
                ))}
              </ul>
            </DetailSection>
          )}

          {candidate.organizationHistory.length > 0 && (
            <DetailSection title="Riwayat Organisasi">
              <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-normal text-ink-body marker:text-ink-subtle">
                {candidate.organizationHistory.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </DetailSection>
          )}

          {/* Di ponsel tombol menempel di bawah agar tetap terjangkau tanpa menggulir seluruh profil. */}
          <div className="sticky bottom-0 z-10 -mx-6 -mb-6 mt-6 flex flex-col-reverse gap-2.5 border-t border-line bg-white px-6 py-4 sm:static sm:m-0 sm:mt-[26px] sm:flex-row sm:border-0 sm:p-0">
            <button type="button" onClick={onClose} className="btn btn-outline h-[46px] px-5">
              Tutup
            </button>
            <button type="button" onClick={() => onPick(candidate)} className="btn btn-primary h-[46px] sm:flex-1">
              Pilih Kandidat Ini
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

interface ConfirmVoteModalProps {
  candidate: Candidate | undefined;
  categoryName: string | undefined;
  open: boolean;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}

export function ConfirmVoteModal({
  candidate,
  categoryName,
  open,
  submitting,
  onCancel,
  onConfirm,
  returnFocusRef,
}: ConfirmVoteModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  if (!candidate) return null;
  return (
    <Modal
      open={open}
      onClose={onCancel}
      role="alertdialog"
      labelledBy="konfirmasi-judul"
      describedBy="konfirmasi-peringatan"
      dismissible={!submitting}
      initialFocusRef={cancelRef}
      returnFocusRef={returnFocusRef}
      panelClassName="max-w-[440px] p-6 text-center sm:p-[30px]"
    >
      <h2 id="konfirmasi-judul" className="text-[21px] font-extrabold">
        Konfirmasi Pilihan Anda
      </h2>
      <p className="mt-2.5 mb-5 text-sm text-ink-muted">
        Kategori <strong className="text-ink">{categoryName}</strong> — Anda memilih:
      </p>
      <div className="flex items-center gap-3.5 rounded-xl border border-line bg-canvas p-[18px] text-left">
        <CandidateBadge number={candidate.candidateNumber} size="lg" className="shadow-none" />
        <div className="min-w-0">
          <p className="text-[17px] font-extrabold">{candidate.name}</p>
          <p className="text-[13px] text-ink-muted">{personMeta(candidate)}</p>
        </div>
      </div>
      <p
        id="konfirmasi-peringatan"
        className="mt-4 flex items-center justify-center gap-2 rounded-control border border-danger-line bg-danger-bg px-3.5 py-[13px] text-[13px] leading-normal font-semibold text-danger-ink"
      >
        <TriangleAlert aria-hidden className="size-4 shrink-0" />
        Pilihan di kategori ini tidak dapat diubah setelah dikonfirmasi.
      </p>
      <div className="mt-[22px] flex flex-col-reverse gap-2.5 sm:flex-row">
        <button ref={cancelRef} type="button" onClick={onCancel} disabled={submitting} className="btn btn-outline h-[46px] sm:flex-1">
          Kembali
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={submitting}
          aria-busy={submitting}
          className="btn btn-primary h-[46px] sm:flex-[1.3]"
        >
          {submitting && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
          {submitting ? 'Menyimpan…' : 'Konfirmasi Suara'}
        </button>
      </div>
    </Modal>
  );
}
