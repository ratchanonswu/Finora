"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useFinora } from "@/context/FinoraContext";
import { formatTHB } from "@/lib/seed";
import { TransactionModal } from "./TransactionModal";

const AI_NAV_ITEM = {
  href: "/ai-assistant",
  label: "ผู้ช่วย AI & สแกน QR",
  icon: "auto_awesome",
  badge: "AI",
};

const NAV_ITEMS = [
  { href: "/", label: "ภาพรวมการเงิน", icon: "space_dashboard" },
  { href: "/transactions", label: "รายรับรายจ่าย", icon: "receipt_long" },
  { href: "/recurring", label: "ตัด/รับเงินอัตโนมัติ", icon: "autorenew" },
  { href: "/categories", label: "จัดการหมวดหมู่", icon: "category" },
  { href: "/settings", label: "ตั้งค่าระบบ", icon: "settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { hydrated, theme, toggleTheme, bankBalance, user, logoutUser, setTxModalOpen } = useFinora();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (hydrated && !user.isLoggedIn) {
      router.replace("/login");
    }
  }, [hydrated, user.isLoggedIn, router]);

  const currentNav =
    [AI_NAV_ITEM, ...NAV_ITEMS].find((item) => item.href === pathname) || NAV_ITEMS[0];

  const handleLogout = () => {
    logoutUser();
    router.replace("/login");
  };

  if (!hydrated || !user.isLoggedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-sm text-on-surface-variant">
        กำลังตรวจสอบสถานะการเข้าสู่ระบบ...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={`fixed left-0 top-0 bottom-0 z-50 w-72 ${
          collapsed ? "lg:w-20" : "lg:w-72"
        } bg-surface-container-low border-r border-outline-variant/30 flex flex-col justify-between transition-all duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          <div
            className={`h-16 flex items-center border-b border-outline-variant/20 ${
              collapsed ? "lg:justify-center lg:px-0 px-5 justify-between" : "px-5 justify-between"
            }`}
          >
            <Link
              href="/"
              className={`flex items-center gap-2.5 min-w-0 ${collapsed ? "lg:hidden" : ""}`}
            >
              <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center font-bold shrink-0">
                F
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight text-on-surface leading-tight">
                  Finora
                </span>
                <span className="text-[10px] font-semibold text-primary uppercase tracking-wider leading-tight">
                  AI Wealth Engine
                </span>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "ขยายแถบเมนู" : "ย่อแถบเมนู"}
              title={collapsed ? "ขยายแถบเมนู" : "ย่อแถบเมนู"}
              className="hidden lg:flex items-center justify-center p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-[20px] leading-none">
                {collapsed ? "left_panel_open" : "left_panel_close"}
              </span>
            </button>
          </div>

          <div className="px-3 pt-4">
            <Link
              href={AI_NAV_ITEM.href}
              title={collapsed ? AI_NAV_ITEM.label : undefined}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center rounded-xl text-sm font-semibold transition-colors py-2.5 ${
                collapsed
                  ? "lg:justify-center lg:px-0 px-3.5 justify-between"
                  : "px-3.5 justify-between"
              } ${
                pathname === AI_NAV_ITEM.href
                  ? "bg-primary-container text-on-primary-container shadow-sm"
                  : "bg-primary-container/15 text-primary border border-primary/30 hover:bg-primary-container/25"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="material-symbols-outlined text-[20px] shrink-0">
                  {AI_NAV_ITEM.icon}
                </span>
                <span className={`whitespace-nowrap truncate ${collapsed ? "lg:hidden" : ""}`}>
                  {AI_NAV_ITEM.label}
                </span>
              </div>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                  collapsed ? "lg:hidden" : ""
                } ${
                  pathname === AI_NAV_ITEM.href
                    ? "bg-on-primary-container/20 text-on-primary-container"
                    : "bg-primary text-on-primary"
                }`}
              >
                {AI_NAV_ITEM.badge}
              </span>
            </Link>
          </div>

          <div className={`px-4 pt-4 pb-2 ${collapsed ? "lg:hidden" : ""}`}>
            <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-outline">
              เมนูหลัก
            </span>
          </div>

          <nav className={`flex flex-col gap-1 px-3 ${collapsed ? "lg:pt-3" : ""}`}>
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center rounded-lg text-sm transition-colors py-2.5 ${
                    collapsed
                      ? "lg:justify-center lg:px-0 px-3.5 justify-between"
                      : "px-3.5 justify-between"
                  } ${
                    active
                      ? "bg-primary-container text-on-primary-container font-semibold shadow-sm"
                      : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px] shrink-0">
                      {item.icon}
                    </span>
                    <span className={`whitespace-nowrap ${collapsed ? "lg:hidden" : ""}`}>
                      {item.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Virtual Wallet Summary Widget */}
        <div className="p-3 sm:p-4">
          <div
            title={collapsed ? `Virtual Wallet: ${formatTHB(bankBalance)}` : undefined}
            className={`block rounded-xl bg-surface-container border border-outline-variant/30 ${
              collapsed ? "lg:p-3 p-4" : "p-4"
            }`}
          >
            {collapsed && (
              <div className="hidden lg:flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[22px]">
                  account_balance_wallet
                </span>
              </div>
            )}
            <div className={collapsed ? "lg:hidden" : ""}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  Virtual Wallet
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-primary">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Active
                </span>
              </div>
              <div className="text-xl font-bold tracking-tight text-on-surface">
                {formatTHB(bankBalance)}
              </div>
              <div className="mt-1.5 text-[11px] text-on-surface-variant">
                <span className="font-mono">782-2-90145-8</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          collapsed ? "lg:pl-20" : "lg:pl-72"
        }`}
      >
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-30 h-16 bg-surface/90 backdrop-blur-md border-b border-outline-variant/30 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high"
              aria-label="เปิดเมนู"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-on-surface">{currentNav.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Dual Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-container-low border border-outline-variant/30 text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
              title={theme === "light" ? "สลับเป็น Emerald Nocturne (Dark)" : "สลับเป็น Light Fintech"}
            >
              <span className="material-symbols-outlined text-[18px]">
                {theme === "light" ? "dark_mode" : "light_mode"}
              </span>
              <span className="hidden sm:inline">
                {theme === "light" ? "Dark Mode" : "Light Mode"}
              </span>
            </button>

            {/* Quick Add Transaction */}
            <button
              type="button"
              onClick={() => setTxModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary-container text-on-primary-container text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span className="hidden sm:inline">บันทึกธุรกรรม</span>
            </button>

            {/* User Profile + Quick Logout */}
            <div className="hidden md:flex items-center gap-2.5 pl-2 border-l border-outline-variant/30">
              <div className="w-8 h-8 rounded-full bg-primary-container/20 text-primary flex items-center justify-center font-bold text-sm">
                {user.name.charAt(0)}
              </div>
              <span className="text-xs font-semibold text-on-surface leading-tight">
                {user.name}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                title="ออกจากระบบ"
                className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      <TransactionModal />
    </div>
  );
}
