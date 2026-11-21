"use client";

import React, { useId, useRef } from "react";
import { useDialogAccessibility } from "@/lib/useDialogAccessibility";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  icon?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Accessible confirmation modal with Escape close, backdrop click, and focus trapping. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  variant = "danger",
  icon = "warning",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useDialogAccessibility(open, dialogRef, onCancel, !loading);

  if (!open) return null;

  const isDanger = variant === "danger";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-backdrop-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => {
        if (!loading) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-md rounded-xl bg-surface-container border border-outline-variant/40 shadow-2xl overflow-hidden animate-modal-in focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-6 py-4 border-b border-outline-variant/30">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              isDanger
                ? "bg-error-container/60 text-error"
                : "bg-primary-container/15 text-primary"
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">{icon}</span>
          </div>
          <div>
            <h2 id={titleId} className="text-base font-semibold text-on-surface m-0">
              {title}
            </h2>
            <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <div className="px-6 py-4 flex items-center justify-end gap-2.5 bg-surface-container-low/40">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-outline-variant/40 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-opacity shadow-sm disabled:opacity-50 ${
              isDanger
                ? "bg-error text-on-error hover:opacity-90"
                : "bg-primary-container text-on-primary-container hover:opacity-90"
            }`}
          >
            {loading ? "กำลังดำเนินการ..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
