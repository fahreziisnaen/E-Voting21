import type { ElectionPhase } from '../types';

export type Tone = 'success' | 'warning' | 'neutral';

export const PHASE_INFO: Record<ElectionPhase, { label: string; banner: string; tone: Tone; message: string }> = {
  active: {
    label: 'Aktif',
    banner: 'Pemungutan suara berlangsung',
    tone: 'success',
    message: 'Pemungutan suara sedang berlangsung.',
  },
  outside_hours: {
    label: 'Di Luar Jam',
    banner: 'Di luar jam pemungutan suara',
    tone: 'warning',
    message: 'Saat ini di luar jam pemungutan suara. Silakan kembali pada jam yang telah ditentukan.',
  },
  upcoming: {
    label: 'Belum Dimulai',
    banner: 'Pemungutan suara belum dimulai',
    tone: 'warning',
    message: 'Pemungutan suara belum dimulai. Silakan kembali sesuai jadwal.',
  },
  draft: {
    label: 'Belum Dibuka',
    banner: 'Draf — belum dibuka',
    tone: 'neutral',
    message: 'Pemungutan suara belum dibuka oleh panitia.',
  },
  ended: {
    label: 'Selesai',
    banner: 'Masa pemungutan suara selesai',
    tone: 'neutral',
    message: 'Masa pemungutan suara telah berakhir.',
  },
  closed: {
    label: 'Ditutup',
    banner: 'Ditutup oleh panitia',
    tone: 'neutral',
    message: 'Pemungutan suara telah ditutup oleh panitia.',
  },
};

export const TONE_BADGE: Record<Tone, string> = {
  success: 'bg-success-bg text-success-ink',
  warning: 'bg-warning-bg text-warning-ink',
  neutral: 'bg-line-soft text-ink-body',
};
