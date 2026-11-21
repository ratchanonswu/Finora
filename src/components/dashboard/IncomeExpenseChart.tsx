"use client";

import React, { useMemo, useState } from "react";
import { formatTHB } from "@/lib/seed";
import { formatCompactTHB, type BarBucket, type ChartGranularity } from "./dashboard-utils";

const GRANULARITY_TABS: Array<{ id: ChartGranularity; label: string }> = [
  { id: "monthly", label: "รายเดือน" },
  { id: "weekly", label: "รายสัปดาห์" },
  { id: "yearly", label: "รายปี" },
];

function computeNiceMax(rawMax: number): number {
  if (rawMax <= 0) return 10_000;
  const roughStep = rawMax / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const residual = roughStep / magnitude;
  const niceStep =
    residual <= 1 ? 1 * magnitude : residual <= 2 ? 2 * magnitude : residual <= 5 ? 5 * magnitude : 10 * magnitude;
  return Math.max(niceStep * 4, Math.ceil(rawMax / niceStep) * niceStep);
}

export function IncomeExpenseChart({
  buckets,
  granularity,
  onGranularityChange,
}: {
  buckets: BarBucket[];
  granularity: ChartGranularity;
  onGranularityChange: (g: ChartGranularity) => void;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const hasAnyData = useMemo(
    () => buckets.some((b) => b.income > 0 || b.expense > 0),
    [buckets]
  );

  const maxVal = useMemo(() => {
    const raw = Math.max(0, ...buckets.map((b) => Math.max(b.income, b.expense)));
    return computeNiceMax(raw);
  }, [buckets]);

  const yTicks = useMemo(() => [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(maxVal * r)), [maxVal]);

  const svgWidth = 640;
  const svgHeight = 250;
  const padLeft = 56;
  const padRight = 16;
  const padTop = 18;
  const padBottom = 34;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const colCount = Math.max(1, buckets.length);
  const colW = plotW / colCount;
  const barW = Math.min(24, Math.max(10, colW * 0.24));
  const barGap = Math.max(4, barW * 0.25);

  const hoveredBucket = hoveredIdx !== null ? buckets[hoveredIdx] ?? null : null;

  return (
    <div className="h-full rounded-2xl bg-white dark:bg-surface-container border border-slate-200/75 dark:border-outline-variant/30 p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.06)] dark:shadow-none flex flex-col justify-between">
      {/* Header + Granularity Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-primary-container/20 text-emerald-600 dark:text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[19px]">bar_chart</span>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-on-surface m-0 leading-tight">
              ภาพรวมรายรับรายจ่าย
            </h2>
            <p className="text-xs text-slate-500 dark:text-on-surface-variant mt-0.5">
              {granularity === "monthly"
                ? "เปรียบเทียบรายรับ-รายจ่าย 6 เดือนล่าสุด"
                : granularity === "weekly"
                  ? "ความเคลื่อนไหว 7 วันล่าสุด"
                  : "เปรียบเทียบรายปี 4 ปีย้อนหลัง"}
            </p>
          </div>
        </div>

        <div className="inline-flex self-start sm:self-auto p-1 rounded-xl bg-slate-100/90 dark:bg-surface-container-low border border-slate-200/70 dark:border-outline-variant/30 gap-0.5">
          {GRANULARITY_TABS.map((t) => {
            const active = granularity === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setHoveredIdx(null);
                  onGranularityChange(t.id);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  active
                    ? "bg-white dark:bg-surface-container-high text-emerald-700 dark:text-primary shadow-sm border border-emerald-200/70 dark:border-primary/30"
                    : "text-slate-500 dark:text-on-surface-variant hover:text-slate-900 dark:hover:text-on-surface"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-5 text-xs mb-2">
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-600 dark:text-on-surface-variant">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-primary" />
          รายรับ
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-600 dark:text-on-surface-variant">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 dark:bg-secondary" />
          รายจ่าย
        </span>
      </div>

      {/* Chart Area */}
      <div className="relative w-full">
        {!hasAnyData ? (
          <div className="h-[230px] rounded-xl border border-dashed border-slate-200 dark:border-outline-variant/30 flex flex-col items-center justify-center gap-2 text-center px-4">
            <span className="material-symbols-outlined text-[30px] text-slate-300 dark:text-outline">
              insert_chart
            </span>
            <p className="text-sm font-medium text-slate-500 dark:text-on-surface-variant">
              ยังไม่มีข้อมูลรายรับ-รายจ่ายในช่วงเวลานี้
            </p>
          </div>
        ) : (
          <div className="relative w-full h-[240px] sm:h-[260px]">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-full overflow-visible select-none"
              role="img"
              aria-label="กราฟแท่งเปรียบเทียบรายรับและรายจ่าย"
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Horizontal Gridlines & Y-Axis Labels */}
              {yTicks.map((tick) => {
                const ratio = maxVal > 0 ? tick / maxVal : 0;
                const y = padTop + plotH - ratio * plotH;
                return (
                  <g key={tick}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={svgWidth - padRight}
                      y2={y}
                      stroke="currentColor"
                      strokeDasharray={tick === 0 ? undefined : "4 4"}
                      className={
                        tick === 0
                          ? "text-slate-200 dark:text-outline-variant/40"
                          : "text-slate-100 dark:text-outline-variant/25"
                      }
                      strokeWidth="1"
                    />
                    <text
                      x={padLeft - 10}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-400 dark:fill-on-surface-variant text-[11px] font-mono"
                    >
                      {tick === 0 ? "0" : formatCompactTHB(tick).replace("฿", "")}
                    </text>
                  </g>
                );
              })}

              {/* Columns & Paired Bars */}
              {buckets.map((bucket, idx) => {
                const colX = padLeft + idx * colW;
                const centerX = colX + colW / 2;
                const incomeH = maxVal > 0 ? Math.max(bucket.income > 0 ? 4 : 0, (bucket.income / maxVal) * plotH) : 0;
                const expenseH = maxVal > 0 ? Math.max(bucket.expense > 0 ? 4 : 0, (bucket.expense / maxVal) * plotH) : 0;
                const incomeX = centerX - barW - barGap / 2;
                const expenseX = centerX + barGap / 2;
                const baseY = padTop + plotH;
                const isHovered = hoveredIdx === idx;

                return (
                  <g
                    key={bucket.key}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onFocus={() => setHoveredIdx(idx)}
                    onBlur={() => setHoveredIdx(null)}
                    tabIndex={0}
                    className="cursor-pointer outline-none"
                    aria-label={`${bucket.fullLabel}: รายรับ ${formatTHB(bucket.income)}, รายจ่าย ${formatTHB(bucket.expense)}`}
                  >
                    {/* Hover Highlight Band */}
                    <rect
                      x={colX + 4}
                      y={padTop}
                      width={Math.max(10, colW - 8)}
                      height={plotH}
                      rx={8}
                      className={
                        isHovered
                          ? "fill-slate-100/80 dark:fill-surface-container-high/50 transition-colors"
                          : "fill-transparent"
                      }
                    />

                    {/* Income Bar */}
                    {incomeH > 0 && (
                      <rect
                        x={incomeX}
                        y={baseY - incomeH}
                        width={barW}
                        height={incomeH}
                        rx={Math.min(6, barW / 2)}
                        className="fill-emerald-500 dark:fill-primary transition-opacity duration-150"
                        opacity={hoveredIdx !== null && !isHovered ? 0.55 : 1}
                      />
                    )}

                    {/* Expense Bar */}
                    {expenseH > 0 && (
                      <rect
                        x={expenseX}
                        y={baseY - expenseH}
                        width={barW}
                        height={expenseH}
                        rx={Math.min(6, barW / 2)}
                        className="fill-red-400 dark:fill-secondary transition-opacity duration-150"
                        opacity={hoveredIdx !== null && !isHovered ? 0.55 : 1}
                      />
                    )}

                    {/* X-Axis Label */}
                    <text
                      x={centerX}
                      y={baseY + 20}
                      textAnchor="middle"
                      className={`text-[11px] font-medium ${
                        isHovered
                          ? "fill-slate-900 dark:fill-on-surface font-semibold"
                          : "fill-slate-500 dark:fill-on-surface-variant"
                      }`}
                    >
                      {bucket.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Interactive Hover Tooltip */}
            {hoveredBucket && hoveredIdx !== null && (
              <div
                className="pointer-events-none absolute top-1 z-20 rounded-xl bg-slate-900 dark:bg-surface-container-highest text-white dark:text-on-surface px-3.5 py-2.5 text-xs shadow-lg border border-slate-700/60 dark:border-outline-variant/40 min-w-[175px]"
                style={{
                  left: `${Math.min(72, Math.max(8, ((hoveredIdx + 0.5) / colCount) * 85 + 8))}%`,
                  transform: "translateX(-50%)",
                }}
              >
                <div className="font-semibold mb-1.5 text-slate-200 dark:text-on-surface">
                  {hoveredBucket.fullLabel}
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-1.5 text-emerald-300 dark:text-primary">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 dark:bg-primary" />
                    รายรับ
                  </span>
                  <span className="font-mono font-bold">{formatTHB(hoveredBucket.income)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 mt-1">
                  <span className="inline-flex items-center gap-1.5 text-red-300 dark:text-secondary">
                    <span className="w-2 h-2 rounded-full bg-red-400 dark:bg-secondary" />
                    รายจ่าย
                  </span>
                  <span className="font-mono font-bold">{formatTHB(hoveredBucket.expense)}</span>
                </div>
                <div className="mt-1.5 pt-1.5 border-t border-white/15 dark:border-outline-variant/30 flex items-center justify-between gap-4">
                  <span className="text-slate-300 dark:text-on-surface-variant">สุทธิ</span>
                  <span
                    className={`font-mono font-bold ${
                      hoveredBucket.net >= 0
                        ? "text-emerald-300 dark:text-primary"
                        : "text-red-300 dark:text-secondary"
                    }`}
                  >
                    {formatTHB(hoveredBucket.net)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
