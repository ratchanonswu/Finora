"use client";

import React from "react";
import Link from "next/link";
import type { DashboardInsight } from "./dashboard-utils";

export function AiInsightsCard({ insight }: { insight: DashboardInsight }) {
  return (
    <div className="h-full rounded-2xl bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-white dark:from-primary-container/15 dark:via-surface-container dark:to-surface-container border border-emerald-200/80 dark:border-primary/25 p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_8px_24px_-12px_rgba(16,185,129,0.14)] dark:shadow-none flex flex-col justify-between gap-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 dark:bg-primary-container text-white dark:text-on-primary-container flex items-center justify-center shadow-sm shadow-emerald-500/20 shrink-0">
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-on-surface m-0">
              AI Insights
            </h2>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/80 dark:bg-surface-container-high border border-emerald-200/70 dark:border-outline-variant/30 text-emerald-700 dark:text-primary">
            วิเคราะห์จากข้อมูลจริง
          </span>
        </div>

        <div className="flex items-start gap-2.5 pt-1">
          <span
            className={`material-symbols-outlined text-[20px] shrink-0 mt-0.5 ${
              insight.tone === "warning"
                ? "text-amber-500"
                : insight.tone === "positive"
                  ? "text-emerald-600 dark:text-primary"
                  : "text-slate-500 dark:text-on-surface-variant"
            }`}
          >
            {insight.tone === "warning" ? "lightbulb" : "insights"}
          </span>
          <div className="space-y-1.5 min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-on-surface leading-snug">
              {insight.headline}
            </p>
            <p className="text-xs text-slate-600 dark:text-on-surface-variant leading-relaxed">
              {insight.detail}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-2 border-t border-emerald-200/50 dark:border-outline-variant/25">
        <p className="text-[11px] font-mono text-slate-600 dark:text-on-surface-variant truncate">
          {insight.secondary}
        </p>

        <Link
          href="/ai-assistant"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-surface-container-high border border-emerald-200/80 dark:border-outline-variant/40 text-xs font-semibold text-emerald-700 dark:text-primary hover:bg-emerald-500 hover:text-white dark:hover:bg-primary-container dark:hover:text-on-primary-container transition-colors shadow-sm"
        >
          <span>ดูคำแนะนำเพิ่มเติมกับ Finora AI</span>
          <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
        </Link>
      </div>
    </div>
  );
}
