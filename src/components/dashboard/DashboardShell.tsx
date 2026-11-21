"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useFinora } from "@/context/FinoraContext";
import { formatTHB, formatThaiDate } from "@/lib/seed";
import { TransactionModal } from "@/components/TransactionModal";
import { buildDashboardNotifications } from "./dashboard-utils";

const DASHBOARD_NAV_ITEMS = [
  { href: "/", label: "หน้าหลัก", icon: "home", badge: undefined },
  { href: "/transactions", label: "รายรับรายจ่าย", icon: "receipt_long", badge: undefined },
  { href: "/recurring", label: "ตัด/รับเงินอัตโนมัติ", icon: "autorenew", badge: undefined },
  { href: "/categories", label: "จัดการหมวดหมู่", icon: "category", badge: undefined },
  { href: "/ai-assistant", label: "ผู้ช่วย AI & สแกน QR", icon: "auto_awesome", badge: "AI" },
  { href: "/settings", label: "ตั้งค่าระบบ", icon: "settings", badge: undefined },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    hydrated,
    theme,
    toggleTheme,
    bankBalance,
    user,
    logoutUser,
    setTxModalOpen,
    transactions,
    categories,
    recurring,
    settings,
  } = useFinora();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const notifBoxRef = useRef<HTMLDivElement | null>(null);
  const profileBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    router.prefetch("/login");
  }, [router]);

  useEffect(() => {
    if (!hydrated || user.isLoggedIn) return;
    router.replace("/login");
    const fallback = window.setTimeout(() => {
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }, 1200);
    return () => window.clearTimeout(fallback);
  }, [hydrated, user.isLoggedIn, router]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
        setNotifOpen(false);
        setProfileOpen(false);
      } else if (e.key === "Escape") {
        setSearchOpen(false);
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
      if (searchBoxRef.current && !searchBoxRef.current.contains(target)) {
        setSearchOpen(false);
      }
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

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return transactions
      .filter((tx) => {
        const cat = categories.find((c) => c.id === tx.categoryId);
        return (
          tx.title.toLowerCase().includes(q) ||
          tx.channel.toLowerCase().includes(q) ||
          tx.ref.toLowerCase().includes(q) ||
          (cat?.name.toLowerCase().includes(q) ?? false)
        );
      })
      .slice(0, 6);
  }, [searchQuery, transactions, categories]);

  if (!hydrated || !user.isLoggedIn) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 text-sm text-on-surface-variant">
        <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span>
          {hydrated ? "กำลังนำทางไปหน้าเข้าสู่ระบบ..." : "กำลังตรวจสอบสถานะการเข้าสู่ระบบ..."}
        </span>
        {hydrated && !user.isLoggedIn && (
          <Link href="/login" className="text-xs font-semibold text-primary hover:underline mt-1">
            คลิกที่นี่หากไม่เปลี่ยนหน้าอัตโนมัติ
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F8F7] dark:bg-background text-on-surface flex">
      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px] lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={`fixed left-0 top-0 bottom-0 z-50 w-64 ${
          collapsed ? "lg:w-20" : "lg:w-64"
        } bg-white dark:bg-surface-container-low border-r border-slate-200/80 dark:border-outline-variant/30 flex flex-col justify-between transition-all duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col min-h-0">
          {/* Brand Header */}
          <div
            className={`h-16 flex items-center border-b border-slate-100 dark:border-outline-variant/20 ${
              collapsed ? "lg:justify-center lg:px-0 px-5 justify-between" : "px-5 justify-between"
            }`}
          >
            <Link
              href="/"
              className={`flex items-center gap-2.5 min-w-0 ${collapsed ? "lg:hidden" : ""}`}
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-500 dark:bg-primary-container text-white dark:text-on-primary-container flex items-center justify-center font-bold text-base shadow-sm shadow-emerald-500/25 shrink-0">
                F
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-on-surface leading-tight">
                  Finora
                </span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-primary uppercase tracking-wider leading-tight">
                  AI Wealth Engine
                </span>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "ขยายแถบเมนู" : "ย่อแถบเมนู"}
              title={collapsed ? "ขยายแถบเมนู" : "ย่อแถบเมนู"}
              className="hidden lg:flex items-center justify-center p-1.5 rounded-lg text-slate-400 dark:text-on-surface-variant hover:text-slate-700 dark:hover:text-on-surface hover:bg-slate-100 dark:hover:bg-surface-container-high transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-[20px] leading-none">
                {collapsed ? "left_panel_open" : "left_panel_close"}
              </span>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1 px-3 pt-4">
            {DASHBOARD_NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center rounded-xl text-sm transition-all py-2.5 ${
                    collapsed
                      ? "lg:justify-center lg:px-0 px-3.5 justify-between"
                      : "px-3.5 justify-between"
                  } ${
                    active
                      ? "bg-emerald-500 dark:bg-primary-container text-white dark:text-on-primary-container font-semibold shadow-sm shadow-emerald-500/25"
                      : "text-slate-600 dark:text-on-surface-variant hover:bg-slate-100/80 dark:hover:bg-surface-container-high hover:text-slate-900 dark:hover:text-on-surface font-medium"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="material-symbols-outlined text-[20px] shrink-0">
                      {item.icon}
                    </span>
                    <span className={`whitespace-nowrap truncate ${collapsed ? "lg:hidden" : ""}`}>
                      {item.label}
                    </span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                        collapsed ? "lg:hidden" : ""
                      } ${
                        active
                          ? "bg-white/25 text-white"
                          : "bg-emerald-100 dark:bg-primary-container/25 text-emerald-700 dark:text-primary"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Virtual Wallet + Logout */}
        <div className="p-3 space-y-2 border-t border-slate-100 dark:border-outline-variant/20">
          <Link
            href="/virtual-bank"
            onClick={() => setMobileOpen(false)}
            className={`block rounded-xl bg-slate-50/90 dark:bg-surface-container border border-slate-200/80 dark:border-outline-variant/30 p-3.5 hover:border-emerald-300 dark:hover:border-primary/40 transition-colors ${
              collapsed ? "lg:hidden" : ""
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-on-surface-variant">
                Virtual Wallet
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-primary" />
                พร้อมใช้
              </span>
            </div>
            <div
              className={`text-lg font-bold font-mono tracking-tight ${
                bankBalance < 0
                  ? "text-red-500 dark:text-secondary"
                  : "text-slate-900 dark:text-on-surface"
              }`}
            >
              {formatTHB(bankBalance)}
            </div>
            <div className="text-[11px] font-mono text-slate-400 dark:text-outline mt-0.5">
              782-2-90145-8
            </div>
          </Link>

          <button
            type="button"
            onClick={logoutUser}
            title={collapsed ? "ออกจากระบบ" : undefined}
            className={`w-full flex items-center rounded-xl text-sm font-medium text-slate-500 dark:text-on-surface-variant hover:text-red-600 dark:hover:text-error hover:bg-red-50/80 dark:hover:bg-error-container/15 py-2.5 transition-colors ${
              collapsed ? "lg:justify-center lg:px-0 px-3.5 gap-3" : "px-3.5 gap-3"
            }`}
          >
            <span className="material-symbols-outlined text-[20px] shrink-0">logout</span>
            <span className={collapsed ? "lg:hidden" : ""}>ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          collapsed ? "lg:pl-20" : "lg:pl-64"
        }`}
      >
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-30 h-16 bg-white/90 dark:bg-surface/90 backdrop-blur-md border-b border-slate-200/80 dark:border-outline-variant/30 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
          {/* Left: Mobile Drawer Trigger + Search */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-on-surface-variant hover:bg-slate-100 dark:hover:bg-surface-container-high shrink-0"
              aria-label="เปิดเมนู"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>

            <div ref={searchBoxRef} className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-outline text-[18px] pointer-events-none">
                search
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onFocus={() => setSearchOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                }}
                placeholder="ค้นหารายการ, หมวดหมู่ หรือช่องทาง..."
                aria-label="ค้นหาธุรกรรม"
                className="w-full bg-slate-100/80 dark:bg-surface-container-low border border-slate-200/70 dark:border-outline-variant/40 rounded-xl pl-10 pr-14 py-2 text-sm text-slate-900 dark:text-on-surface placeholder:text-slate-400 dark:placeholder:text-outline focus:outline-none focus:bg-white dark:focus:bg-surface-container focus:border-emerald-500 dark:focus:border-primary transition-colors"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="ล้างคำค้นหา"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-white dark:bg-surface-container border border-slate-200/80 dark:border-outline-variant/40 text-[10px] font-mono text-slate-400 dark:text-outline absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  ⌘K
                </kbd>
              )}

              {/* Search Results Popover */}
              {searchOpen && searchQuery.trim() && (
                <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl bg-white dark:bg-surface-container border border-slate-200/80 dark:border-outline-variant/40 shadow-xl overflow-hidden z-40 animate-modal-in">
                  <div className="px-4 py-2.5 border-b border-slate-100 dark:border-outline-variant/20 flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-on-surface-variant">
                    <span>ผลการค้นหาธุรกรรม ({searchMatches.length})</span>
                    <Link
                      href="/transactions"
                      onClick={() => setSearchOpen(false)}
                      className="text-emerald-600 dark:text-primary hover:underline"
                    >
                      ดูทั้งหมด →
                    </Link>
                  </div>
                  {searchMatches.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 dark:text-on-surface-variant">
                      ไม่พบรายการที่ตรงกับ &ldquo;{searchQuery.trim()}&rdquo;
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-outline-variant/20 max-h-80 overflow-y-auto">
                      {searchMatches.map((tx) => {
                        const cat = categories.find((c) => c.id === tx.categoryId);
                        return (
                          <Link
                            key={tx.id}
                            href="/transactions"
                            onClick={() => setSearchOpen(false)}
                            className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-surface-container-high/50 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                style={{
                                  backgroundColor: `${cat?.color || "#10B981"}1A`,
                                  color: cat?.color || "#10B981",
                                }}
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  {cat?.icon || "receipt_long"}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-900 dark:text-on-surface truncate">
                                  {tx.title}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-on-surface-variant truncate">
                                  {formatThaiDate(tx.date)} • {cat?.name || tx.categoryId}
                                </div>
                              </div>
                            </div>
                            <span
                              className={`text-xs font-mono font-bold shrink-0 ${
                                tx.type === "income"
                                  ? "text-emerald-600 dark:text-primary"
                                  : "text-red-500 dark:text-secondary"
                              }`}
                            >
                              {tx.type === "income" ? "+" : "-"}
                              {formatTHB(Math.abs(tx.amount))}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Quick Add Transaction */}
            <button
              type="button"
              onClick={() => setTxModalOpen(true)}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl bg-emerald-500 dark:bg-primary-container text-white dark:text-on-primary-container text-xs sm:text-sm font-semibold hover:bg-emerald-600 dark:hover:opacity-90 transition-all shadow-sm shadow-emerald-500/20"
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
                  setNotifOpen((o) => !o);
                  setProfileOpen(false);
                }}
                aria-label="การแจ้งเตือน"
                aria-expanded={notifOpen}
                className="relative w-9 h-9 rounded-xl border border-slate-200/80 dark:border-outline-variant/40 bg-white dark:bg-surface-container-low text-slate-600 dark:text-on-surface-variant hover:text-slate-900 dark:hover:text-on-surface hover:bg-slate-50 dark:hover:bg-surface-container-high flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-[19px]">notifications</span>
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none shadow-sm">
                    {notifications.length}
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
                      className="text-[11px] font-semibold text-emerald-600 dark:text-primary hover:underline"
                    >
                      ตั้งค่า
                    </Link>
                  </div>

                  {notifications.length === 0 ? (
                    <div className="p-6 text-center space-y-1">
                      <span className="material-symbols-outlined text-[26px] text-emerald-500 dark:text-primary">
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
                                ? "bg-red-50 dark:bg-error-container/25 text-red-500 dark:text-error"
                                : n.severity === "warning"
                                  ? "bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300"
                                  : "bg-emerald-50 dark:bg-primary-container/20 text-emerald-600 dark:text-primary"
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
            <div ref={profileBoxRef} className="relative pl-1 sm:pl-2 border-l border-slate-200/80 dark:border-outline-variant/30">
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
                <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white dark:bg-surface-container border border-slate-200/80 dark:border-outline-variant/40 shadow-xl overflow-hidden z-40 animate-modal-in">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-outline-variant/20">
                    <div className="text-sm font-semibold text-slate-900 dark:text-on-surface truncate">
                      {user.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-on-surface-variant truncate">
                      {user.email}
                    </div>
                  </div>
                  <div className="p-2 space-y-1 text-xs">
                    <Link
                      href="/virtual-bank"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center justify-between px-3 py-2 rounded-lg text-slate-700 dark:text-on-surface hover:bg-slate-100/80 dark:hover:bg-surface-container-high"
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[17px] text-emerald-600 dark:text-primary">
                          account_balance_wallet
                        </span>
                        Virtual Wallet
                      </span>
                      <span className="font-mono font-semibold">{formatTHB(bankBalance)}</span>
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-on-surface hover:bg-slate-100/80 dark:hover:bg-surface-container-high"
                    >
                      <span className="material-symbols-outlined text-[17px] text-slate-500 dark:text-on-surface-variant">
                        settings
                      </span>
                      <span>ตั้งค่าโปรไฟล์และระบบ</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        toggleTheme();
                        setProfileOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-on-surface hover:bg-slate-100/80 dark:hover:bg-surface-container-high text-left"
                    >
                      <span className="material-symbols-outlined text-[17px] text-slate-500 dark:text-on-surface-variant">
                        {theme === "light" ? "dark_mode" : "light_mode"}
                      </span>
                      <span>{theme === "light" ? "เปิด Dark Mode" : "เปิด Light Mode"}</span>
                    </button>
                  </div>
                  <div className="p-2 border-t border-slate-100 dark:border-outline-variant/20">
                    <button
                      type="button"
                      onClick={logoutUser}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 dark:text-error hover:bg-red-50 dark:hover:bg-error-container/15 text-left"
                    >
                      <span className="material-symbols-outlined text-[17px]">logout</span>
                      <span>ออกจากระบบ</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Page Body */}
        <main
          key={pathname}
          className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto animate-page-in"
        >
          {children}
        </main>
      </div>

      <TransactionModal />
    </div>
  );
}
