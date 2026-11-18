"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useFinora } from "@/context/FinoraContext";
import { formatTHB, formatThaiDate, isInCurrentQuotaCycle } from "@/lib/seed";

const MONTHLY_SERIES = [
  { month: "ต.ค.", income: 74000, expense: 41000 },
  { month: "พ.ย.", income: 78000, expense: 39000 },
  { month: "ธ.ค.", income: 92000, expense: 52000 },
  { month: "ม.ค.", income: 81000, expense: 35000 },
  { month: "ก.พ.", income: 84000, expense: 37000 },
  { month: "มี.ค.*", income: 89320, expense: 32450 },
];

export default function DashboardPage() {
  const { user, bankBalance, transactions, categories, settings } = useFinora();

  const stats = useMemo(() => {
    const income = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    const savingsRate = income > 0 ? Math.max(0, Math.round(((income - expense) / income) * 100)) : 0;
    return { income, expense, net: income - expense, savingsRate };
  }, [transactions]);

  const categoryTotals = useMemo(() => {
    const expenseTx = transactions.filter(
      (t) => t.type === "expense" && isInCurrentQuotaCycle(t.date, settings.quotaResetAt)
    );
    const total = expenseTx.reduce((s, t) => s + t.amount, 0) || 1;
    return categories
      .filter((c) => c.type === "expense" && c.id !== "recurring")
      .map((c) => {
        const sum = expenseTx
          .filter((t) => t.categoryId === c.id)
          .reduce((s, t) => s + t.amount, 0);
        return { ...c, sum, pct: Math.round((sum / total) * 100) };
      })
      .sort((a, b) => b.sum - a.sum);
  }, [transactions, categories, settings.quotaResetAt]);

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome Bar */}
      <div>
        <h1 className="text-2xl font-bold text-on-surface tracking-tight m-0">
          สวัสดี, {user.name}
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          ภาพรวมสินทรัพย์ส่วนบุคคลและสถานะกระเป๋าเงินจำลองแบบเรียลไทม์
        </p>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl bg-surface-container border border-outline-variant/30 p-5 flex flex-col justify-between transition-colors hover:border-outline-variant/60">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                ยอดเงิน Virtual Wallet
              </span>
              <div className="text-2xl font-bold font-mono text-on-surface tracking-tight mt-1">
                {formatTHB(bankBalance)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary-container/15 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined">account_balance_wallet</span>
            </div>
          </div>
          <div className="mt-4 text-xs text-primary font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px]">verified</span>
            <span className="font-mono">782-2-90145-8 • พร้อมใช้งาน</span>
          </div>
        </div>

        <div className="rounded-xl bg-surface-container border border-outline-variant/30 p-5 flex flex-col justify-between transition-colors hover:border-outline-variant/60">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                รายรับทั้งหมด
              </span>
              <div className="text-2xl font-bold font-mono text-primary tracking-tight mt-1">
                {formatTHB(stats.income)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary-container/15 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined">arrow_downward</span>
            </div>
          </div>
          <div className="mt-4 text-xs text-on-surface-variant">
            จาก {transactions.filter((t) => t.type === "income").length} รายการในระบบ
          </div>
        </div>

        <div className="rounded-xl bg-surface-container border border-outline-variant/30 p-5 flex flex-col justify-between transition-colors hover:border-outline-variant/60">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                รายจ่ายทั้งหมด
              </span>
              <div className="text-2xl font-bold font-mono text-secondary tracking-tight mt-1">
                {formatTHB(stats.expense)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-secondary-container/20 text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined">arrow_upward</span>
            </div>
          </div>
          <div className="mt-4 text-xs text-on-surface-variant">
            จาก {transactions.filter((t) => t.type === "expense").length} รายการในระบบ
          </div>
        </div>

        <div className="rounded-xl bg-surface-container border border-outline-variant/30 p-5 flex flex-col justify-between transition-colors hover:border-outline-variant/60">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                อัตราการออม (Savings Rate)
              </span>
              <div className="text-2xl font-bold font-mono text-tertiary tracking-tight mt-1">
                {stats.savingsRate}%
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-tertiary-container/20 text-tertiary flex items-center justify-center">
              <span className="material-symbols-outlined">savings</span>
            </div>
          </div>
          <div className="mt-4 text-xs text-on-surface-variant">
            กระแสเงินสดสุทธิ <span className="font-mono">{formatTHB(stats.net)}</span>
          </div>
        </div>
      </div>

      {/* AI Insights Banner (Flat Dividers, Zero Nested Cards) */}
      <div className="rounded-2xl bg-surface-container border border-outline-variant/30 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
            </div>
            <div>
              <h2 className="text-base font-semibold text-on-surface m-0">
                Finora AI Insights &amp; Intelligence
              </h2>
              <p className="text-xs text-on-surface-variant">
                สรุปพฤติกรรมการใช้จ่ายและการพยากรณ์เงินออมจากข้อมูลจริงของคุณ
              </p>
            </div>
          </div>
          <Link
            href="/ai-assistant"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-xs font-semibold text-on-surface"
          >
            <span>ปรึกษา AI Assistant</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-outline-variant/30 border-t border-outline-variant/30 pt-2">
          <div className="py-3 md:pr-6 flex flex-col justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                หมวดใช้จ่ายสูงสุด
              </span>
              <p className="text-sm text-on-surface mt-1 leading-relaxed">
                หมวดหมู่ <strong>{categoryTotals[0]?.name || "-"}</strong> มียอดใช้จ่ายรวม{" "}
                <span className="font-mono font-semibold">
                  {formatTHB(categoryTotals[0]?.sum || 0)}
                </span>{" "}
                ({categoryTotals[0]?.pct || 0}% ของรายจ่ายรอบนี้)
              </p>
            </div>
            <Link href="/categories" className="text-xs text-primary hover:underline">
              จัดการงบประมาณ →
            </Link>
          </div>

          <div className="py-3 md:pl-6 flex flex-col justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-tertiary">
                สถานะสภาพคล่อง
              </span>
              <p className="text-sm text-on-surface mt-1 leading-relaxed">
                กระแสเงินสดสุทธิ{stats.net >= 0 ? "เป็นบวก" : "ติดลบ"}{" "}
                <span
                  className={`font-mono font-semibold ${
                    stats.net >= 0 ? "text-primary" : "text-secondary"
                  }`}
                >
                  {formatTHB(stats.net)}
                </span>{" "}
                พร้อมอัตราการออม {stats.savingsRate}%
              </p>
            </div>
            <Link href="/transactions" className="text-xs text-primary hover:underline">
              ดูรายการทั้งหมด →
            </Link>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 6-Month Bar Chart */}
        <div className="lg:col-span-7 rounded-2xl bg-surface-container border border-outline-variant/30 p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold text-on-surface m-0">
                เปรียบเทียบรายรับและรายจ่าย (6 เดือน)
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">ต.ค. 2024 - มี.ค. 2025</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-primary" /> รายรับ
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-secondary" /> รายจ่าย
              </span>
            </div>
          </div>

          <div className="h-52 flex items-end justify-between gap-3 pt-4">
            {MONTHLY_SERIES.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <div className="flex items-end gap-1.5 h-full w-full justify-center">
                  <div
                    className="w-3.5 sm:w-5 bg-primary rounded-t animate-bar-grow hover:opacity-85 transition-opacity"
                    style={{ height: `${Math.round((m.income / 100000) * 100)}%` }}
                    title={`รายรับ: ${formatTHB(m.income)}`}
                  />
                  <div
                    className="w-3.5 sm:w-5 bg-secondary rounded-t animate-bar-grow hover:opacity-85 transition-opacity"
                    style={{ height: `${Math.round((m.expense / 100000) * 100)}%` }}
                    title={`รายจ่าย: ${formatTHB(m.expense)}`}
                  />
                </div>
                <span className="text-[11px] font-mono text-on-surface-variant">{m.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="lg:col-span-5 rounded-2xl bg-surface-container border border-outline-variant/30 p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-on-surface m-0">
                สัดส่วนรายจ่ายตามหมวดหมู่
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                ยอดจ่ายรวม {formatTHB(stats.expense)}
              </p>
            </div>
            <Link href="/categories" className="text-xs font-semibold text-primary hover:underline">
              ปรับแต่ง
            </Link>
          </div>

          <div className="space-y-3.5">
            {categoryTotals.map((cat) => (
              <div key={cat.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-on-surface">{cat.name}</span>
                  <span className="font-mono text-on-surface-variant">
                    {cat.pct}% • {formatTHB(cat.sum)}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-container-highest overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${cat.pct}%`, backgroundColor: cat.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="rounded-2xl bg-surface-container border border-outline-variant/30 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-on-surface m-0">รายการธุรกรรมล่าสุด</h2>
          <Link href="/transactions" className="text-xs font-semibold text-primary hover:underline">
            ดูทั้งหมด ({transactions.length}) →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                <th className="py-3 pr-4">รายการ</th>
                <th className="py-3 px-4">หมวดหมู่</th>
                <th className="py-3 px-4">ช่องทาง</th>
                <th className="py-3 px-4">วันที่</th>
                <th className="py-3 pl-4 text-right">จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {transactions.slice(0, 5).map((tx) => {
                const cat = categories.find((c) => c.id === tx.categoryId);
                return (
                  <tr key={tx.id} className="hover:bg-surface-container-low/50 transition-colors duration-150">
                    <td className="py-3.5 pr-4">
                      <div className="font-semibold text-on-surface">{tx.title}</div>
                      <div className="text-[11px] font-mono text-outline">{tx.ref}</div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-on-surface-variant">
                      <span className="inline-flex items-center gap-1.5">
                        {cat?.color && (
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                        )}
                        <span>{cat?.name || tx.categoryId}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-on-surface-variant">{tx.channel}</td>
                    <td className="py-3.5 px-4 text-xs font-mono text-on-surface-variant">
                      {formatThaiDate(tx.date)}
                    </td>
                    <td
                      className={`py-3.5 pl-4 text-right font-mono font-bold ${
                        tx.type === "income" ? "text-primary" : "text-secondary"
                      }`}
                    >
                      {tx.type === "income" ? "+" : "-"}
                      {formatTHB(tx.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
