"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFinora } from "@/context/FinoraContext";
import { formatTHB, todayYmd } from "@/lib/seed";
import { AiInsightsCard } from "@/components/dashboard/AiInsightsCard";
import { BudgetOverviewCard } from "@/components/dashboard/BudgetOverviewCard";
import { ExpenseBreakdownCard } from "@/components/dashboard/ExpenseBreakdownCard";
import { IncomeExpenseChart } from "@/components/dashboard/IncomeExpenseChart";
import { RecentTransactionsCard } from "@/components/dashboard/RecentTransactionsCard";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import {
  buildBarChartSeries,
  buildDashboardInsights,
  buildSparklineSeries,
  computeBudgetOverview,
  computeExpenseBreakdown,
  computePeriodSummary,
  evaluateBudgetLiquidityGap,
  filterTransactionsByRange,
  getThaiGreeting,
  localDateToYmd,
  resolveDateRange,
  type ChartGranularity,
  type DatePreset,
} from "@/components/dashboard/dashboard-utils";

const PRESET_OPTIONS: Array<{ id: DatePreset; label: string }> = [
  { id: "this_month", label: "เดือนนี้" },
  { id: "last_7_days", label: "7 วันที่ผ่านมา" },
  { id: "last_30_days", label: "30 วันที่ผ่านมา" },
  { id: "this_year", label: "ปีนี้" },
  { id: "all_time", label: "ทั้งหมด" },
];

export default function DashboardPage() {
  const {
    user,
    bankBalance,
    transactions,
    categories,
    recurring,
    settings,
    setTxModalOpen,
  } = useFinora();

  const [greeting, setGreeting] = useState("สวัสดี");
  const [datePreset, setDatePreset] = useState<DatePreset>("this_month");
  const [customStart, setCustomStart] = useState(() => {
    const now = new Date();
    return localDateToYmd(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [customEnd, setCustomEnd] = useState(() => todayYmd());
  const [draftStart, setDraftStart] = useState(customStart);
  const [draftEnd, setDraftEnd] = useState(customEnd);
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [chartGranularity, setChartGranularity] = useState<ChartGranularity>("monthly");

  const dateMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setGreeting(getThaiGreeting(new Date().getHours()));
  }, []);

  useEffect(() => {
    if (!dateMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (dateMenuRef.current && !dateMenuRef.current.contains(e.target as Node)) {
        setDateMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDateMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dateMenuOpen]);

  const dateRange = useMemo(
    () => resolveDateRange(datePreset, customStart, customEnd),
    [datePreset, customStart, customEnd]
  );

  const filteredTransactions = useMemo(
    () => filterTransactionsByRange(transactions, dateRange.startYmd, dateRange.endYmd),
    [transactions, dateRange.startYmd, dateRange.endYmd]
  );

  const periodSummary = useMemo(
    () => computePeriodSummary(transactions, dateRange),
    [transactions, dateRange]
  );

  const sparklines = useMemo(
    () => buildSparklineSeries(transactions, dateRange),
    [transactions, dateRange]
  );

  const barBuckets = useMemo(
    () =>
      buildBarChartSeries(
        transactions,
        chartGranularity,
        dateRange.preset === "custom" ? dateRange.endYmd : undefined
      ),
    [transactions, chartGranularity, dateRange.preset, dateRange.endYmd]
  );

  const budgetSummary = useMemo(
    () => computeBudgetOverview(categories, transactions, settings.quotaResetAt),
    [categories, transactions, settings.quotaResetAt]
  );

  const liquidityGap = useMemo(
    () =>
      evaluateBudgetLiquidityGap({
        budgetSummary,
        summary: periodSummary,
        bankBalance,
        rangePreset: dateRange.preset,
      }),
    [budgetSummary, periodSummary, bankBalance, dateRange.preset]
  );

  const expenseBreakdown = useMemo(
    () => computeExpenseBreakdown(filteredTransactions, categories),
    [filteredTransactions, categories]
  );

  const insight = useMemo(
    () =>
      buildDashboardInsights({
        summary: periodSummary,
        budgetSummary,
        breakdown: expenseBreakdown,
        recurring,
        bankBalance,
        range: dateRange,
        totalTxCount: transactions.length,
      }),
    [
      periodSummary,
      budgetSummary,
      expenseBreakdown,
      recurring,
      bankBalance,
      dateRange,
      transactions.length,
    ]
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome Header & Date Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-[26px] font-bold text-slate-900 dark:text-on-surface tracking-tight m-0 leading-snug">
            {greeting}, {user.name}
          </h1>
          <p className="text-sm text-slate-500 dark:text-on-surface-variant mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>มาดูภาพรวมการเงินของคุณกัน</span>
            <span className="text-slate-300 dark:text-outline">•</span>
            <span>
              Virtual Wallet:{" "}
              <strong
                className={`font-mono ${
                  bankBalance < 0
                    ? "text-red-600 dark:text-secondary"
                    : "text-emerald-700 dark:text-primary"
                }`}
              >
                {formatTHB(bankBalance)}
              </strong>
            </span>
          </p>
        </div>

        {/* Date Filter Control */}
        <div ref={dateMenuRef} className="relative self-start md:self-auto shrink-0">
          <button
            type="button"
            onClick={() => {
              const nextOpen = !dateMenuOpen;
              if (nextOpen) {
                setDraftStart(customStart);
                setDraftEnd(customEnd);
              }
              setDateMenuOpen(nextOpen);
            }}
            aria-expanded={dateMenuOpen}
            aria-haspopup="dialog"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-surface-container border border-slate-200/80 dark:border-outline-variant/40 text-xs sm:text-sm font-medium text-slate-700 dark:text-on-surface hover:border-emerald-300 dark:hover:border-primary/50 shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined text-[18px] text-emerald-700 dark:text-primary">
              calendar_today
            </span>
            <span className="font-semibold">{dateRange.label}</span>
            <span className="text-slate-600 dark:text-on-surface-variant font-mono text-xs hidden sm:inline">
              ({dateRange.shortRangeLabel})
            </span>
            <span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-outline">
              expand_more
            </span>
          </button>

          {dateMenuOpen && (
            <div
              role="dialog"
              aria-label="เลือกช่วงเวลาแสดงข้อมูล"
              className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-white dark:bg-surface-container border border-slate-200/80 dark:border-outline-variant/40 shadow-xl p-3 space-y-3 z-40 animate-modal-in"
            >
              <div className="space-y-1">
                {PRESET_OPTIONS.map((opt) => {
                  const active = datePreset === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setDatePreset(opt.id);
                        setDateMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                        active
                          ? "bg-emerald-50 dark:bg-primary-container/20 text-emerald-700 dark:text-primary"
                          : "text-slate-700 dark:text-on-surface hover:bg-slate-100/80 dark:hover:bg-surface-container-high"
                      }`}
                    >
                      <span>{opt.label}</span>
                      {active && (
                        <span className="material-symbols-outlined text-[16px]">check</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2.5 border-t border-slate-100 dark:border-outline-variant/20 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-on-surface-variant">
                  กำหนดช่วงวันที่เอง
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="dash-start-date"
                      className="block text-[10px] text-slate-600 dark:text-on-surface-variant mb-1"
                    >
                      ตั้งแต่
                    </label>
                    <input
                      id="dash-start-date"
                      type="date"
                      value={draftStart}
                      max={draftEnd || undefined}
                      onChange={(e) => setDraftStart(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-surface-container-low border border-slate-200/80 dark:border-outline-variant/40 rounded-lg px-2 py-1.5 text-[11px] font-mono text-slate-900 dark:text-on-surface"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="dash-end-date"
                      className="block text-[10px] text-slate-600 dark:text-on-surface-variant mb-1"
                    >
                      ถึง
                    </label>
                    <input
                      id="dash-end-date"
                      type="date"
                      value={draftEnd}
                      min={draftStart || undefined}
                      onChange={(e) => setDraftEnd(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-surface-container-low border border-slate-200/80 dark:border-outline-variant/40 rounded-lg px-2 py-1.5 text-[11px] font-mono text-slate-900 dark:text-on-surface"
                    />
                  </div>
                </div>
                {draftStart && draftEnd && draftStart > draftEnd && (
                  <p role="alert" className="text-[11px] font-medium text-red-600 dark:text-error">
                    วันเริ่มต้นต้องไม่เกินวันสิ้นสุด
                  </p>
                )}
                <button
                  type="button"
                  disabled={!draftStart || !draftEnd || draftStart > draftEnd}
                  onClick={() => {
                    if (!draftStart || !draftEnd || draftStart > draftEnd) return;
                    setCustomStart(draftStart);
                    setCustomEnd(draftEnd);
                    setDatePreset("custom");
                    setDateMenuOpen(false);
                  }}
                  className="w-full py-2 rounded-xl bg-emerald-700 dark:bg-primary-container text-white dark:text-on-primary-container text-xs font-semibold hover:bg-emerald-800 dark:hover:opacity-90 disabled:opacity-50"
                >
                  ใช้ช่วงวันที่นี้
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4 Financial Summary Cards */}
      <SummaryCards
        summary={periodSummary}
        sparklines={sparklines}
        budgetSummary={budgetSummary}
        liquidityGap={liquidityGap}
      />

      {/* Middle Row: Income vs Expense Chart + Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 xl:col-span-8">
          <IncomeExpenseChart
            buckets={barBuckets}
            granularity={chartGranularity}
            onGranularityChange={setChartGranularity}
          />
        </div>
        <div className="lg:col-span-5 xl:col-span-4">
          <RecentTransactionsCard
            transactions={filteredTransactions}
            categories={categories}
            onAddTransaction={() => setTxModalOpen(true)}
          />
        </div>
      </div>

      {/* Bottom Row: AI Insights + Budget Overview + Expense Breakdown Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <AiInsightsCard insight={insight} />
        </div>
        <div className="lg:col-span-4">
          <BudgetOverviewCard budgetSummary={budgetSummary} />
        </div>
        <div className="lg:col-span-4">
          <ExpenseBreakdownCard breakdown={expenseBreakdown} />
        </div>
      </div>
    </div>
  );
}
