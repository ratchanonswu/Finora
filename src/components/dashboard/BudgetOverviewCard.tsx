"use client";

import React from "react";
import Link from "next/link";
import { formatTHB } from "@/lib/seed";
import type { BudgetOverviewSummary } from "./dashboard-utils";

export function BudgetOverviewCard({ budgetSummary }: { budgetSummary: BudgetOverviewSummary }) {
  return (
    <div className="h-full rounded-2xl bg-white dark:bg-surface-container border border-slate-200/75 dark:border-outline-variant/30 p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.06)] dark:shadow-none flex flex-col justify-between gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-primary-container/20 text-emerald-700 dark:text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[18px]">flag</span>
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-on-surface m-0 truncate">
            ภาพรวมงบประมาณ
          </h2>
        </div>

        <Link
          href="/categories"
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-primary hover:underline shrink-0"
        >
          <span>จัดการงบทั้งหมด</span>
          <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
        </Link>
      </div>

      {!budgetSummary.hasBudgets ? (
        <div className="flex-1 min-h-[160px] rounded-xl border border-dashed border-slate-200 dark:border-outline-variant/30 flex flex-col items-center justify-center gap-2 text-center p-4">
          <span className="material-symbols-outlined text-[28px] text-slate-400 dark:text-outline">
            category
          </span>
          <p className="text-xs font-medium text-slate-600 dark:text-on-surface-variant">
            ยังไม่มีการกำหนดงบประมาณรายเดือนในหมวดหมู่
          </p>
          <Link
            href="/categories"
            className="text-xs font-semibold text-emerald-700 dark:text-primary hover:underline"
          >
            ตั้งงบประมาณหมวดหมู่ →
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3 flex-1 max-h-[340px] overflow-y-auto pr-1">
            {budgetSummary.items.map((cat) => {
              const barWidth = Math.min(100, cat.pct);
              const isNear = !cat.over && cat.pct >= 80;

              return (
                <div key={cat.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-2 font-semibold text-slate-800 dark:text-on-surface min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="truncate">{cat.name}</span>
                    </span>
                    <span
                      className={`font-mono font-semibold shrink-0 ${
                        cat.over
                          ? "text-red-600 dark:text-error"
                          : isNear
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-slate-600 dark:text-on-surface-variant"
                      }`}
                    >
                      {cat.pct}%
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-surface-container-highest overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        cat.over ? "bg-red-600 dark:bg-error" : ""
                      }`}
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: cat.over ? undefined : cat.color,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-on-surface-variant">
                    <span>
                      {formatTHB(cat.spent)} / {formatTHB(cat.budget)}
                    </span>
                    <span className={cat.over ? "text-red-600 dark:text-error font-semibold" : ""}>
                      {cat.over
                        ? `เกิน ${formatTHB(Math.abs(cat.remaining))}`
                        : `เหลือ ${formatTHB(cat.remaining)}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pt-3 border-t border-slate-100 dark:border-outline-variant/20 flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-600 dark:text-on-surface-variant truncate">
              รวม {budgetSummary.items.length} หมวด • {budgetSummary.cycleLabel}
            </span>
            <span className="font-mono font-semibold text-slate-700 dark:text-on-surface shrink-0">
              {formatTHB(budgetSummary.totalSpent)} / {formatTHB(budgetSummary.totalBudget)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
