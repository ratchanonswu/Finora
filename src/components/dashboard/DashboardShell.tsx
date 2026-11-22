"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useFinora } from "@/context/FinoraContext";
import { buildDashboardNotifications, type DashboardNotification } from "./dashboard-utils";

const SEEN_NOTIFS_KEY_PREFIX = "finora_seen_notifs_v1";

function notifStorageKey(email: string): string {
  return `${SEEN_NOTIFS_KEY_PREFIX}:${email.trim().toLowerCase()}`;
}

function notifSignature(n: DashboardNotification): string {
  return `${n.id}|${n.title}|${n.description}`;
}

function loadSeenNotifKeys(email: string): Set<string> {
  if (typeof window === "undefined" || !email.trim()) return new Set();
  try {
    const raw = localStorage.getItem(notifStorageKey(email));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((v): v is string => typeof v === "string"))
      : new Set();
  } catch {
    return new Set();
  }
}

export function DashboardHeader({ onOpenMobileMenu }: { onOpenMobileMenu: () => void }) {
  const {
    theme,
    toggleTheme,
    user,
    logoutUser,
    setTxModalOpen,
    transactions,
    categories,
    recurring,
    settings,
  } = useFinora();

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [seenNotifKeys, setSeenNotifKeys] = useState<Set<string>>(() =>
    loadSeenNotifKeys(user.email)
  );

  const notifBoxRef = useRef<HTMLDivElement | null>(null);
  const profileBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSeenNotifKeys(loadSeenNotifKeys(user.email));
  }, [user.email]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNotifOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (notifBoxRef.current && !notifBoxRef.current.contains(target)) {
        setNotifOpen(false);
      }
      if (profileBoxRef.current && !profileBoxRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const notifications = useMemo(
    () => buildDashboardNotifications(categories, transactions, recurring, settings),
    [categories, transactions, recurring, settings]
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !seenNotifKeys.has(notifSignature(n))).length,
    [notifications, seenNotifKeys]
  );

  const markNotificationsRead = () => {
    const next = new Set(notifications.map(notifSignature));
    setSeenNotifKeys(next);
    if (!user.email.trim()) return;
    try {
      localStorage.setItem(notifStorageKey(user.email), JSON.stringify(Array.from(next)));
    } catch {
      // Ignore storage quota errors
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/90 dark:bg-surface/90 backdrop-blur-md border-b border-slate-200/80 dark:border-outline-variant/30 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
      {/* Left: Mobile Drawer Trigger */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-on-surface-variant hover:bg-slate-100 dark:hover:bg-surface-container-high shrink-0"
          aria-label="เปิดเมนู"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Quick Add Transaction */}
        <button
          type="button"
          onClick={() => setTxModalOpen(true)}
          className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl bg-emerald-700 dark:bg-primary-container text-white dark:text-on-primary-container text-xs sm:text-sm font-semibold hover:bg-emerald-800 dark:hover:opacity-90 transition-all shadow-sm shadow-emerald-700/20"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span className="hidden md:inline">บันทึกธุรกรรม</span>
        </button>

        {/* Dark Mode Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "light" ? "เปิดโหมดมืด" : "เปิดโหมดสว่าง"}
          title={
            theme === "light"
              ? "สลับเป็น Emerald Nocturne (Dark Mode)"
              : "สลับเป็น Light Fintech"
          }
          className="w-9 h-9 rounded-xl border border-slate-200/80 dark:border-outline-variant/40 bg-white dark:bg-surface-container-low text-slate-600 dark:text-on-surface-variant hover:text-slate-900 dark:hover:text-on-surface hover:bg-slate-50 dark:hover:bg-surface-container-high flex items-center justify-center transition-colors"
        >
          <span className="material-symbols-outlined text-[19px]">
            {theme === "light" ? "dark_mode" : "light_mode"}
          </span>
        </button>

        {/* Notification Bell + Popover */}
        <div ref={notifBoxRef} className="relative">
          <button
            type="button"
            onClick={() => {
              const nextOpen = !notifOpen;
              setNotifOpen(nextOpen);
              setProfileOpen(false);
              if (nextOpen && notifications.length > 0) {
                markNotificationsRead();
              }
            }}
            aria-label={
              unreadCount > 0
                ? `การแจ้งเตือน (${unreadCount} รายการที่ยังไม่ได้อ่าน)`
                : "การแจ้งเตือน"
            }
            aria-expanded={notifOpen}
            className="relative w-9 h-9 rounded-xl border border-slate-200/80 dark:border-outline-variant/40 bg-white dark:bg-surface-container-low text-slate-600 dark:text-on-surface-variant hover:text-slate-900 dark:hover:text-on-surface hover:bg-slate-50 dark:hover:bg-surface-container-high flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[19px]">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center leading-none shadow-sm">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl bg-white dark:bg-surface-container border border-slate-200/80 dark:border-outline-variant/40 shadow-xl overflow-hidden z-40 animate-modal-in">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-outline-variant/20 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-on-surface">
                  การแจ้งเตือนทางการเงิน ({notifications.length})
                </span>
                <Link
                  href="/settings"
                  onClick={() => setNotifOpen(false)}
                  className="text-[11px] font-semibold text-emerald-700 dark:text-primary hover:underline"
                >
                  ตั้งค่า
                </Link>
              </div>

              {notifications.length === 0 ? (
                <div className="p-6 text-center space-y-1">
                  <span className="material-symbols-outlined text-[26px] text-emerald-700 dark:text-primary">
                    notifications_paused
                  </span>
                  <p className="text-xs font-medium text-slate-600 dark:text-on-surface-variant">
                    ไม่มีแจ้งเตือนงบเกินหรือบิลใกล้ครบกำหนด
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-outline-variant/20 max-h-80 overflow-y-auto">
                  {notifications.map((n) => (
                    <Link
                      key={n.id}
                      href={n.href}
                      onClick={() => setNotifOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-surface-container-high/40 transition-colors"
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          n.severity === "danger"
                            ? "bg-red-50 dark:bg-error-container/25 text-red-600 dark:text-error"
                            : n.severity === "warning"
                              ? "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300"
                              : "bg-emerald-50 dark:bg-primary-container/20 text-emerald-700 dark:text-primary"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[17px]">
                          {n.kind === "budget" ? "warning" : "event_upcoming"}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-slate-900 dark:text-on-surface leading-snug">
                          {n.title}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-on-surface-variant mt-0.5">
                          {n.description}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Profile + Account Dropdown */}
        <div
          ref={profileBoxRef}
          className="relative pl-1 sm:pl-2 border-l border-slate-200/80 dark:border-outline-variant/30"
        >
          <button
            type="button"
            onClick={() => {
              setProfileOpen((o) => !o);
              setNotifOpen(false);
            }}
            aria-expanded={profileOpen}
            className="flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-slate-100/80 dark:hover:bg-surface-container-high transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-primary-container/25 text-emerald-700 dark:text-primary flex items-center justify-center font-bold text-sm shrink-0">
              {user.name.charAt(0)}
            </div>
            <span className="hidden sm:inline text-xs font-semibold text-slate-800 dark:text-on-surface max-w-[130px] truncate">
              {user.name}
            </span>
            <span className="material-symbols-outlined text-[17px] text-slate-400 dark:text-outline hidden sm:inline">
              expand_more
            </span>
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-44 rounded-2xl bg-white dark:bg-surface-container border border-slate-200/80 dark:border-outline-variant/40 shadow-xl overflow-hidden z-40 animate-modal-in p-1.5">
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  logoutUser();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-error hover:bg-red-50 dark:hover:bg-error-container/15 text-left transition-colors"
              >
                <span className="material-symbols-outlined text-[17px]">logout</span>
                <span>ออกจากระบบ</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
