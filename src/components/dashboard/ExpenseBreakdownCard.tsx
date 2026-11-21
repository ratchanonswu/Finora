"use client";

import React, { useMemo, useState } from "react";
import { formatTHB } from "@/lib/seed";
import { formatCompactTHB, type ExpenseBreakdownSummary } from "./dashboard-utils";

interface DonutSegment {
  id: string;
  name: string;
  color: string;
  amount: number;
  pct: number;
  dashArray: string;
  dashOffset: number;
}

export function ExpenseBreakdownCard({
  breakdown,
}: {
  breakdown: ExpenseBreakdownSummary;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const displaySlices = useMemo(() => {
    if (breakdown.slices.length <= 5) return breakdown.slices;
    const top = breakdown.slices.slice(0, 4);
    const rest = breakdown.slices.slice(4);
    const restAmount = rest.reduce((s, r) => s + r.amount, 0);
    const restPct = Math.max(1, 100 - top.reduce((s, t) => s + t.pct, 0));
    return [
      ...top,
      {
        id: "others",
        name: "อื่นๆ",
        icon: "more_horiz",
        color: "#64748B",
        amount: restAmount,
        pct: restPct,
      },
    ];
  }, [breakdown.slices]);

  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  const segments: DonutSegment[] = useMemo(() => {
    if (breakdown.totalExpense <= 0) return [];
    let cumulative = 0;
    return displaySlices.map((s) => {
      const fraction = s.amount / breakdown.totalExpense;
      const length = fraction * circumference;
      const offset = -cumulative;
      cumulative += length;
      return {
        id: s.id,
        name: s.name,
        color: s.color,
        amount: s.amount,
        pct: s.pct,
        dashArray: `${length.toFixed(2)} ${(circumference - length).toFixed(2)}`,
        dashOffset: offset,
      };
    });
  }, [displaySlices, breakdown.totalExpense, circumference]);

  const activeSlice =
    hoveredId !== null ? displaySlices.find((s) => s.id === hoveredId) ?? null : null;

  return (
    <div className="h-full rounded-2xl bg-white dark:bg-surface-container border border-slate-200/75 dark:border-outline-variant/30 p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.06)] dark:shadow-none flex flex-col justify-between gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-surface-container-high text-slate-600 dark:text-on-surface-variant flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[19px]">donut_large</span>
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-on-surface m-0">
            สัดส่วนค่าใช้จ่าย
          </h2>
        </div>
      </div>

      {breakdown.totalExpense <= 0 ? (
        <div className="flex-1 min-h-[160px] flex flex-col items-center justify-center gap-2 text-center py-4">
          <svg viewBox="0 0 120 120" className="w-24 h-24" aria-hidden="true">
            <circle
              cx="60"
              cy="60"
              r="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="14"
              className="text-slate-100 dark:text-surface-container-highest"
            />
          </svg>
          <p className="text-xs font-medium text-slate-500 dark:text-on-surface-variant">
            ไม่มีรายจ่ายในช่วงเวลาที่เลือก
          </p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-5 flex-1">
          {/* Donut SVG */}
          <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
            <svg
              viewBox="0 0 140 140"
              className="w-full h-full -rotate-90"
              role="img"
              aria-label="กราฟโดนัทแสดงสัดส่วนค่าใช้จ่ายตามหมวดหมู่"
              onMouseLeave={() => setHoveredId(null)}
            >
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="18"
                className="text-slate-100 dark:text-surface-container-highest"
              />
              {segments.map((seg) => {
                const isActive = hoveredId === seg.id;
                return (
                  <circle
                    key={seg.id}
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={isActive ? 21 : 18}
                    strokeDasharray={seg.dashArray}
                    strokeDashoffset={seg.dashOffset}
                    opacity={hoveredId && !isActive ? 0.45 : 1}
                    onMouseEnter={() => setHoveredId(seg.id)}
                    className="cursor-pointer transition-all duration-150"
                  />
                );
              })}
            </svg>

            {/* Center Readout */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
              <span className="text-base font-bold font-mono text-slate-900 dark:text-on-surface leading-tight">
                {formatCompactTHB(activeSlice ? activeSlice.amount : breakdown.totalExpense)}
              </span>
              <span className="text-[10px] font-medium text-slate-500 dark:text-on-surface-variant truncate max-w-[78px] mt-0.5">
                {activeSlice ? `${activeSlice.name}` : "รวมค่าใช้จ่าย"}
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-1 w-full space-y-2.5 min-w-0">
            {displaySlices.map((slice) => {
              const isActive = hoveredId === slice.id;
              return (
                <div
                  key={slice.id}
                  onMouseEnter={() => setHoveredId(slice.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`flex items-center justify-between gap-2 px-2 py-1 -mx-2 rounded-lg text-xs cursor-pointer transition-colors ${
                    isActive ? "bg-slate-100/80 dark:bg-surface-container-high/60" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="font-medium text-slate-700 dark:text-on-surface truncate">
                      {slice.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 font-mono">
                    <span className="text-[11px] text-slate-400 dark:text-outline hidden sm:inline lg:hidden xl:inline">
                      {formatTHB(slice.amount)}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-on-surface w-9 text-right">
                      {slice.pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
