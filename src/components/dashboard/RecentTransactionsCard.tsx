"use client";

import React from "react";
import Link from "next/link";
import type { Category, Transaction } from "@/lib/types";
import { formatTHB, formatThaiDate } from "@/lib/seed";

export function RecentTransactionsCard({
  transactions,
  categories,
  onAddTransaction,
}: {
  transactions: Transaction[];
  categories: Category[];
  onAddTransaction: () => void;
}) {
  const recent = transactions.slice(0, 5);

  return (
    <div className="h-full rounded-2xl bg-white dark:bg-surface-container border border-slate-200/75 dark:border-outline-variant/30 p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.06)] dark:shadow-none flex flex-col justify-between">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-surface-container-high text-slate-600 dark:text-on-surface-variant flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[19px]">schedule</span>
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-on-surface m-0">
            รายการล่าสุด
          </h2>
        </div>

        <Link
          href="/transactions"
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-primary hover:underline shrink-0"
        >
          <span>ดูทั้งหมด</span>
          <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
        </Link>
      </div>

      {recent.length === 0 ? (
        <div className="flex-1 min-h-[210px] rounded-xl border border-dashed border-slate-200 dark:border-outline-variant/30 flex flex-col items-center justify-center gap-2.5 text-center p-4">
          <span className="material-symbols-outlined text-[28px] text-slate-400 dark:text-outline">
            receipt_long
          </span>
          <p className="text-xs font-medium text-slate-600 dark:text-on-surface-variant">
            ไม่พบธุรกรรมในช่วงเวลาที่เลือก
          </p>
          <button
            type="button"
            onClick={onAddTransaction}
            className="text-xs font-semibold text-emerald-700 dark:text-primary hover:underline"
          >
            + บันทึกธุรกรรมใหม่
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-outline-variant/20 flex-1">
          {recent.map((tx) => {
            const cat = categories.find((c) => c.id === tx.categoryId);
            const accent = cat?.color || (tx.type === "income" ? "#059669" : "#64748B");
            return (
              <div
                key={tx.id}
                className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-surface-container-high/30 -mx-2 px-2 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${accent}1A`, color: accent }}
                  >
                    <span className="material-symbols-outlined text-[19px]">
                      {cat?.icon || (tx.type === "income" ? "payments" : "receipt_long")}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-on-surface truncate">
                      {tx.title}
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-on-surface-variant truncate mt-0.5">
                      {formatThaiDate(tx.date)} • {cat?.name || tx.categoryId}
                      {tx.channel ? ` • ${tx.channel}` : ""}
                    </div>
                  </div>
                </div>

                <div
                  className={`text-sm font-mono font-bold whitespace-nowrap shrink-0 ${
                    tx.type === "income"
                      ? "text-emerald-700 dark:text-primary"
                      : "text-red-600 dark:text-secondary"
                  }`}
                >
                  {tx.type === "income" ? "+" : "-"}
                  {formatTHB(Math.abs(tx.amount))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
