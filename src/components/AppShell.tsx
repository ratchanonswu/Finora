"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useFinora } from "@/context/FinoraContext";
import { formatTHB } from "@/lib/seed";
import { TransactionModal } from "./TransactionModal";
import { DashboardHeader } from "./dashboard/DashboardShell";

const AI_NAV_ITEM = {
  href: "/ai-assistant",
  label: "ผู้ช่วย AI & สแกนสลิป",
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
  const { hydrated, bankBalance, user } = useFinora();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

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

  if (!hydrated || !user.isLoggedIn) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 text-sm text-on-surface-variant">
        <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span>
          {hydrated ? "กำลังนำทางไปหน้าเข้าสู่ระบบ..." : "กำลังตรวจสอบสถานะการเข้าสู่ระบบ..."}
        </span>
        {hydrated && !user.isLoggedIn && (
          <Link
            href="/login"
            className="text-xs font-semibold text-primary hover:underline mt-1"
          >
            คลิกที่นี่หากไม่เปลี่ยนหน้าอัตโนมัติ
          </Link>
        )}
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${
        pathname === "/" ? "bg-[#F5F8F7] dark:bg-background" : "bg-background"
      } text-on-surface flex`}
    >
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
        <div className={`p-3 sm:p-4 ${collapsed ? "lg:hidden" : ""}`}>
          <div className="block rounded-xl bg-surface-container border border-outline-variant/30 p-4">
            <div className="mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                Virtual Wallet
              </span>
            </div>
            <div
              className={`text-xl font-bold tracking-tight ${
                bankBalance < 0 ? "text-secondary" : "text-on-surface"
              }`}
            >
              {formatTHB(bankBalance)}
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
        <DashboardHeader onOpenMobileMenu={() => setMobileOpen(true)} />

        {/* Page Body */}
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
