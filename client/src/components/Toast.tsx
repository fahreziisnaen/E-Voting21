import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type ToastTone = 'info' | 'success' | 'error';
type ShowToast = (message: string, tone?: ToastTone) => void;

const ToastContext = createContext<ShowToast>(() => {});

const ICONS = {
  info: <Info aria-hidden className="mt-px size-[18px] shrink-0 text-gold" />,
  success: <CircleCheck aria-hidden className="mt-px size-[18px] shrink-0 text-success-line" />,
  error: <CircleAlert aria-hidden className="mt-px size-[18px] shrink-0 text-[#FCA5A5]" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string; tone: ToastTone } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback<ShowToast>((message, tone = 'info') => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone });
    // Pesan galat diberi waktu baca lebih lama.
    timer.current = window.setTimeout(() => setToast(null), tone === 'error' ? 5000 : 3200);
  }, []);

  return (
    <ToastContext value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[90] flex justify-end sm:inset-x-auto sm:right-6 sm:bottom-6">
        {toast && (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-[360px] animate-pop items-start gap-2.5 rounded-xl bg-ink py-3.5 pr-3 pl-4 text-[13px] leading-normal font-semibold text-white shadow-toast"
          >
            {ICONS[toast.tone]}
            <p className="flex-1">{toast.message}</p>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="-my-1 rounded-md p-1 text-on-navy-muted hover:text-white"
              aria-label="Tutup notifikasi"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        )}
      </div>
    </ToastContext>
  );
}

export function useToast(): ShowToast {
  return useContext(ToastContext);
}
