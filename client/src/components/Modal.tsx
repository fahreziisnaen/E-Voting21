import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/cn';

const EXIT_MS = 180;
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let scrollLocks = 0;
function lockScroll() {
  if (scrollLocks++ > 0) return;
  const scrollbar = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.overflow = 'hidden';
  if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
}
function unlockScroll() {
  if (--scrollLocks > 0) return;
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  describedBy?: string;
  children: ReactNode;
  panelClassName?: string;
  role?: 'dialog' | 'alertdialog';
  /** false saat proses penyimpanan berjalan — Esc & klik latar diabaikan. */
  dismissible?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Elemen yang menerima fokus setelah modal tertutup (default: elemen yang membuka modal). */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export function Modal({
  open,
  onClose,
  labelledBy,
  describedBy,
  children,
  panelClassName,
  role = 'dialog',
  dismissible = true,
  initialFocusRef,
  returnFocusRef,
}: ModalProps) {
  const [mounted, setMounted] = useState(open);
  // Disesuaikan saat render agar panel sudah ada di DOM ketika efek fokus berjalan.
  if (open && !mounted) setMounted(true);
  const closing = mounted && !open;

  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);
  const latest = useRef({ onClose, dismissible });
  latest.current = { onClose, dismissible };

  // Animasi keluar: tetap render sebentar setelah `open` menjadi false.
  useEffect(() => {
    if (open || !mounted) return;
    const timer = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);

  // Fokus awal, kunci scroll, lalu kembalikan fokus saat ditutup.
  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
    lockScroll();
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      const target = initialFocusRef?.current ?? panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
      target?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      unlockScroll();
      const active = document.activeElement;
      const focusWasInside = !active || active === document.body || panelRef.current?.contains(active);
      if (!focusWasInside) return; // modal lain sudah mengambil fokus
      const target = [returnFocusRef?.current, openerRef.current].find(
        (el): el is HTMLElement => el instanceof HTMLElement && el.isConnected,
      );
      target?.focus({ preventScroll: true });
    };
  }, [open, initialFocusRef, returnFocusRef]);

  // Esc untuk menutup + perangkap fokus Tab.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (latest.current.dismissible) {
          event.preventDefault();
          latest.current.onClose();
        }
        return;
      }
      const panel = panelRef.current;
      if (event.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      const outside = !panel.contains(active);
      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[60] flex items-center justify-center bg-navy/55 p-4 backdrop-blur-[2px] sm:p-7',
        closing ? 'animate-veil-out' : 'animate-veil',
      )}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && open && dismissible) onClose();
      }}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        inert={closing}
        className={cn(
          'relative max-h-[90vh] w-full overflow-y-auto rounded-modal bg-white outline-none',
          closing ? 'animate-pop-out' : 'animate-pop',
          panelClassName,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
