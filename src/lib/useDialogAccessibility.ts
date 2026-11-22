"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * Adds WAI-ARIA modal behavior: Escape to close, Tab focus trapping inside dialogRef,
 * initial focus fallback, and restoring focus to the triggering element on close.
 */
export function useDialogAccessibility(
  open: boolean,
  dialogRef: RefObject<HTMLElement | null>,
  onClose?: () => void,
  canClose = true
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const canCloseRef = useRef(canClose);
  canCloseRef.current = canClose;

  useEffect(() => {
    if (!open) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const rafId = window.requestAnimationFrame(() => {
      const container = dialogRef.current;
      if (!container) return;
      if (!container.contains(document.activeElement)) {
        const first = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        if (first) first.focus();
        else container.focus();
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (canCloseRef.current && onCloseRef.current) {
          e.preventDefault();
          onCloseRef.current();
        }
        return;
      }

      if (e.key !== "Tab") return;
      const container = dialogRef.current;
      if (!container) return;

      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !container.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", handleKeyDown);
      if (previousFocus && document.contains(previousFocus)) {
        previousFocus.focus();
      }
    };
  }, [open, dialogRef]);
}
