"use client";

import React from "react";
import Link from "next/link";
import { formatTHB } from "@/lib/seed";
import type {
  BudgetOverviewSummary,
  PeriodSummary,
  SparklineSeries,
} from "./dashboard-utils";

function SparklineSvg({
  values,
  color,
  gradientId,
}: {
  values: number[];
  color: string;
  gradientId: string;
}) {
  const safeValues = values.length >= 2 ? values : [0, 0];
  const minVal = Math.min(...safeValues);
  const maxVal = Math.max(...safeValues);
  const range = maxVal - minVal;
  const w = 96;
  const h = 40;
  const padY = 5;
  const usableH = h - padY * 2;

  const coords = safeValues.map((v, idx) => {
    const x = (idx / (safeValues.length - 1)) * w;
    const norm = range === 0 ? 0.5 : (v - minVal) / range;
    const y = padY + usableH - norm * usableH;
    return { x, y };
  });

  const linePoints = coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `M 0,${h} L ${coords
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" L ")} L ${w},${h} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-24 h-10 shrink-0 overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={linePoints}
      />
    </svg>
  );
}

function DeltaCaption({
  pct,
  hasPrevPeriod,
  invertGood = false,
  fallbackText,
}: {
  pct: number | null;
  hasPrevPeriod: boolean;
  invertGood?: boolean;
  fallbackText: string;
}) {
  if (!hasPrevPeriod || pct === null) {
    return (
      <span className="text-xs font-medium text-slate-500 dark:text-on-surface-variant">
        {fallbackText}
      </span>
    );
  }

  const isUp = pct > 0;
  const isZero = pct === 0;
  const isPositiveTone = isZero ? true : invertGood ? !isUp : isUp;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${
        isZero
          ? "text-slate-500 dark:text-on-surface-variant"
          : isPositiveTone
            ? "text-emerald-600 dark:text-primary"
            : "text-red-500 dark:text-secondary"
      }`}
    >
      {!isZero && (
        <span className="material-symbols-outlined text-[15px] leading-none">
          {isUp ? "north_east" : "south_east"}
        </span>
      )}
      <span>
        {isUp ? `+${pct}%` : `${pct}%`} จากช่วงก่อนหน้า
      </span>
    </span>
  );
}

export function SummaryCards({
  summary,
  sparklines,
  budgetSummary,
}: {
  summary: PeriodSummary;
  sparklines: SparklineSeries;
  budgetSummary: BudgetOverviewSummary;
}) {
  const netPositive = summary.net >= 0;
  const budgetBarColor =
    budgetSummary.usedPct >= 100
      ? "bg-red-500 dark:bg-error"
      : budgetSummary.usedPct >= 80
        ? "bg-amber-500"
        : "bg-emerald-500 dark:bg-primary";
  const budgetBarCaption =
    budgetSummary.totalRemaining < 0
      ? budgetSummary.usedPct > 100
        ? `เกิน ${budgetSummary.usedPct - 100}%`
        : "เกินงบ"
      : `เหลือ ${Math.max(0, 100 - budgetSummary.usedPct)}%`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* Card 1: Total Income */}
      <div className="rounded-2xl bg-white dark:bg-surface-container border border-slate-200/75 dark:border-outline-variant/30 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.06)] dark:shadow-none hover:border-emerald-300/80 dark:hover:border-primary/40 transition-all flex flex-col justify-between gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-primary-container/20 text-emerald-600 dark:text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
            </div>
            <span className="text-xs font-semibold text-slate-600 dark:text-on-surface-variant truncate">
              รายรับรวม
            </span>
          </div>
          <span className="text-[11px] font-medium text-slate-400 dark:text-outline shrink-0">
            {summary.incomeCount} รายการ
          </span>
        </div>

        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-on-surface truncate">
              {formatTHB(summary.income)}
            </div>
            <div className="mt-1">
              <DeltaCaption
                pct={summary.incomePctChange}
                hasPrevPeriod={summary.hasPrevPeriod}
                fallbackText={summary.hasPrevPeriod ? "ช่วงก่อนหน้า ฿0.00" : "รวมทุกรายการ"}
              />
            </div>
          </div>
          <SparklineSvg
            values={sparklines.incomeSeries}
            color="#10B981"
            gradientId="finora-spark-income"
          />
        </div>
      </div>

      {/* Card 2: Total Expenses */}
      <div className="rounded-2xl bg-white dark:bg-surface-container border border-slate-200/75 dark:border-outline-variant/30 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.06)] dark:shadow-none hover:border-red-200 dark:hover:border-secondary/40 transition-all flex flex-col justify-between gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-secondary-container/25 text-red-500 dark:text-secondary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">credit_card</span>
            </div>
            <span className="text-xs font-semibold text-slate-600 dark:text-on-surface-variant truncate">
              รายจ่ายรวม
            </span>
          </div>
          <span className="text-[11px] font-medium text-slate-400 dark:text-outline shrink-0">
            {summary.expenseCount} รายการ
          </span>
        </div>

        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-on-surface truncate">
              {formatTHB(summary.expense)}
            </div>
            <div className="mt-1">
              <DeltaCaption
                pct={summary.expensePctChange}
                hasPrevPeriod={summary.hasPrevPeriod}
                invertGood
                fallbackText={summary.hasPrevPeriod ? "ช่วงก่อนหน้า ฿0.00" : "รวมทุกรายการ"}
              />
            </div>
          </div>
          <SparklineSvg
            values={sparklines.expenseSeries}
            color="#EF4444"
            gradientId="finora-spark-expense"
          />
        </div>
      </div>

      {/* Card 3: Net Balance */}
      <div className="rounded-2xl bg-white dark:bg-surface-container border border-slate-200/75 dark:border-outline-variant/30 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.06)] dark:shadow-none hover:border-emerald-300/80 dark:hover:border-primary/40 transition-all flex flex-col justify-between gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                netPositive
                  ? "bg-emerald-50 dark:bg-primary-container/20 text-emerald-600 dark:text-primary"
                  : "bg-red-50 dark:bg-secondary-container/25 text-red-500 dark:text-secondary"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">balance</span>
            </div>
            <span className="text-xs font-semibold text-slate-600 dark:text-on-surface-variant truncate">
              คงเหลือสุทธิ
            </span>
          </div>
          <span className="text-[11px] font-mono font-semibold text-slate-500 dark:text-on-surface-variant shrink-0">
            ออม {summary.savingsRate}%
          </span>
        </div>

        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div
              className={`text-2xl font-bold font-mono tracking-tight truncate ${
                netPositive
                  ? "text-emerald-600 dark:text-primary"
                  : "text-red-500 dark:text-secondary"
              }`}
            >
              {formatTHB(summary.net)}
            </div>
            <div className="mt-1">
              <DeltaCaption
                pct={summary.netPctChange}
                hasPrevPeriod={summary.hasPrevPeriod}
                fallbackText="รายรับหักรายจ่ายในช่วงนี้"
              />
            </div>
          </div>
          <SparklineSvg
            values={sparklines.netSeries}
            color={netPositive ? "#10B981" : "#EF4444"}
            gradientId="finora-spark-net"
          />
        </div>
      </div>

      {/* Card 4: Monthly Budget Remaining */}
      <div className="rounded-2xl bg-white dark:bg-surface-container border border-slate-200/75 dark:border-outline-variant/30 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.06)] dark:shadow-none hover:border-emerald-300/80 dark:hover:border-primary/40 transition-all flex flex-col justify-between gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                budgetSummary.totalRemaining < 0
                  ? "bg-red-50 dark:bg-secondary-container/25 text-red-500 dark:text-secondary"
                  : "bg-teal-50 dark:bg-primary-container/20 text-teal-600 dark:text-primary"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">track_changes</span>
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-semibold text-slate-600 dark:text-on-surface-variant truncate">
                งบประมาณคงเหลือ
              </span>
              {budgetSummary.hasBudgets && (
                <span className="block text-[10px] text-slate-400 dark:text-outline truncate">
                  รวมงบ {budgetSummary.items.length} หมวด • {budgetSummary.cycleLabel}
                </span>
              )}
            </div>
          </div>
          {budgetSummary.hasBudgets && (
            <span
              className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 ${
                budgetSummary.usedPct >= 100
                  ? "bg-red-50 dark:bg-error-container/25 text-red-600 dark:text-error"
                  : budgetSummary.usedPct >= 80
                    ? "bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300"
                    : "bg-emerald-50 dark:bg-primary-container/20 text-emerald-700 dark:text-primary"
              }`}
            >
              ใช้ {budgetSummary.usedPct}%
            </span>
          )}
        </div>

        {budgetSummary.hasBudgets ? (
          <div className="space-y-2.5">
            <div>
              <div
                className={`text-2xl font-bold font-mono tracking-tight truncate ${
                  budgetSummary.totalRemaining < 0
                    ? "text-red-500 dark:text-secondary"
                    : "text-slate-900 dark:text-on-surface"
                }`}
              >
                {formatTHB(budgetSummary.totalRemaining)}
              </div>
              <div className="text-[11px] font-mono text-slate-500 dark:text-on-surface-variant mt-0.5 truncate">
                ใช้ไป {formatTHB(budgetSummary.totalSpent)} / {formatTHB(budgetSummary.totalBudget)}
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-surface-container-highest overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${budgetBarColor}`}
                  style={{ width: `${Math.min(100, budgetSummary.usedPct)}%` }}
                />
              </div>
              <span
                className={`text-xs font-mono font-semibold shrink-0 ${
                  budgetSummary.totalRemaining < 0
                    ? "text-red-500 dark:text-error"
                    : "text-slate-600 dark:text-on-surface-variant"
                }`}
              >
                {budgetBarCaption}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col justify-between gap-2">
            <div className="text-sm font-medium text-slate-500 dark:text-on-surface-variant">
              ยังไม่ได้ตั้งงบประมาณหมวดหมู่
            </div>
            <Link
              href="/categories"
              className="text-xs font-semibold text-emerald-600 dark:text-primary hover:underline inline-flex items-center gap-1"
            >
              <span>ตั้งงบประมาณ →</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
