import React, { useEffect, useRef } from 'react';
import { LogOut, X } from 'lucide-react';
import { User } from '../types.ts';

interface LogoutConfirmModalProps {
  isOpen: boolean;
  user: User;
  onCancel: () => void;
  onConfirmLogout: () => void;
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
  isOpen,
  user,
  onCancel,
  onConfirmLogout,
}) => {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus the safe default "Cancel" button when the modal opens
    const timer = setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 10);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-[2px]"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-confirm-title"
      aria-describedby="logout-confirm-desc"
    >
      <div
        className="w-full max-w-[380px] rounded-xl surface-card p-5 sm:p-6 space-y-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#e5484d]/12 border border-[#e5484d]/25 flex items-center justify-center text-negative shrink-0">
              <LogOut className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h2
                id="logout-confirm-title"
                className="text-[16px] font-medium text-ink-primary leading-snug"
              >
                Are you sure you want to log out?
              </h2>
              <p className="text-[12px] text-ink-muted font-mono truncate mt-0.5">
                {user.email}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg text-ink-muted hover:text-ink-primary hover:bg-[var(--bg-raised)] transition-colors"
            aria-label="Close confirmation dialog"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <p
          id="logout-confirm-desc"
          className="text-[13px] text-ink-secondary leading-relaxed"
        >
          Your financial ledger remains safely stored in your account. You will need to sign back in to view or record transactions.
        </p>

        {/* Actions: Cancel (safe default) & Logout (destructive action) */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            className="h-10 px-4 btn-secondary rounded-lg text-[13px] font-medium flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text-primary)]"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirmLogout}
            className="h-10 px-4 rounded-lg bg-[#e5484d] hover:bg-[#d93d42] active:bg-[#c9353a] text-white text-[13px] font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
};
