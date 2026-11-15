"use client";

import React from "react";
import Link from "next/link";
import { useFinora } from "@/context/FinoraContext";

interface AuthShellProps {
  showcaseTitle: string;
  showcaseSubtitle: string;
  highlights: { icon: string; title: string; desc: string }[];
  footerBadge: string;
  children: React.ReactNode;
}

export function AuthShell({
  showcaseTitle,
  showcaseSubtitle,
  highlights,
  footerBadge,
  children,
}: AuthShellProps) {
  const { theme, toggleTheme } = useFinora();

  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center p-4 sm:p-6 lg:p-10 relative">
      {/* Top-right Theme Toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        className="fixed top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-container border border-outline-variant/40 text-xs font-medium text-on-surface-variant hover:text-on-surface shadow-sm"
      >
        <span className="material-symbols-outlined text-[18px]">
          {theme === "light" ? "dark_mode" : "light_mode"}
        </span>
        <span>{theme === "light" ? "Dark Mode" : "Light Mode"}</span>
      </button>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 min-h-[620px] border border-outline-variant/30 overflow-hidden shadow-2xl bg-surface-container-lowest">
        {/* Left Brand Column */}
        <div className="lg:col-span-5 bg-surface-container-low p-8 lg:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-outline-variant/20">
          <div>
            <Link href="/" className="flex items-center gap-2.5 mb-8">
              <div className="w-9 h-9 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-lg">
                F
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight text-on-surface leading-tight">
                  Finora
                </span>
                <span className="text-[11px] font-semibold text-primary uppercase tracking-wider leading-tight">
                  AI Wealth Engine
                </span>
              </div>
            </Link>

            <h2 className="text-2xl font-bold text-on-surface mb-3 tracking-tight">
              {showcaseTitle}
            </h2>
            <p className="text-sm text-on-surface-variant leading-relaxed mb-8">
              {showcaseSubtitle}
            </p>

            <div className="flex flex-col divide-y divide-outline-variant/20 text-sm">
              {highlights.map((item) => (
                <div key={item.title} className="py-3.5 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary-container/15 text-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-on-surface">{item.title}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-8 mt-6 border-t border-outline-variant/20 flex items-center justify-between text-xs text-on-surface-variant">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-primary">lock</span>
              <span>{footerBadge}</span>
            </div>
            <span className="font-mono text-[11px] text-outline">Finora v2.4 SaaS</span>
          </div>
        </div>

        {/* Right Form Column */}
        <div className="lg:col-span-7 p-8 lg:p-14 flex flex-col justify-center bg-surface-container">
          <div className="max-w-md w-full mx-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}
