"use client";

import React, { useMemo, useState } from "react";
import { useFinora } from "@/context/FinoraContext";
import { formatTHB, formatThaiDate, toDateInputValue } from "@/lib/seed";

export default function TransactionsPage() {
  const { transactions, categories, setTxModalOpen, deleteTransaction, updateTransactionDate } =
    useFinora();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [catFilter, setCatFilter] = useState("all");
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [editingDateVal, setEditingDateVal] = useState("");

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;
      if (catFilter !== "all" && tx.categoryId !== catFilter) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        return (
          tx.title.toLowerCase().includes(q) ||
          tx.ref.toLowerCase().includes(q) ||
          tx.channel.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [transactions, typeFilter, catFilter, query]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight m-0">
            รายรับรายจ่ายทั้งหมด
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            ค้นหา กรอง และจัดการประวัติธุรกรรมทางการเงินของคุณ ({filtered.length} รายการ)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTxModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary-container text-on-primary-container text-sm font-semibold hover:opacity-90 shadow-sm self-start"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>เพิ่มรายการใหม่</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="rounded-xl bg-surface-container border border-outline-variant/30 p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
            search
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อรายการ, เลขอ้างอิง, ช่องทาง..."
            className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg pl-9 pr-4 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as "all" | "income" | "expense")}
          className="bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
        >
          <option value="all">ทุกประเภท</option>
          <option value="income">รายรับ (Income)</option>
          <option value="expense">รายจ่าย (Expense)</option>
        </select>

        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
        >
          <option value="all">ทุกหมวดหมู่</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Transactions Table */}
      <div className="rounded-2xl bg-surface-container border border-outline-variant/30 p-6">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-on-surface-variant">
            ไม่พบรายการธุรกรรมที่ตรงกับเงื่อนไขการค้นหา
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-outline-variant/30 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  <th className="py-3 pr-4">รายการ</th>
                  <th className="py-3 px-4">หมวดหมู่</th>
                  <th className="py-3 px-4">ช่องทาง</th>
                  <th className="py-3 px-4">วันที่</th>
                  <th className="py-3 px-4 text-right">จำนวนเงิน</th>
                  <th className="py-3 pl-4 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {filtered.map((tx) => {
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
                      <td className="py-3.5 px-4 text-xs font-mono text-on-surface-variant whitespace-nowrap">
                        {editingDateId === tx.id ? (
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="date"
                              aria-label="แก้ไขวันที่ธุรกรรม"
                              autoFocus
                              value={editingDateVal}
                              onChange={(e) => setEditingDateVal(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && /^\d{4}-\d{2}-\d{2}$/.test(editingDateVal)) {
                                  updateTransactionDate(tx.id, editingDateVal);
                                  setEditingDateId(null);
                                } else if (e.key === "Escape") {
                                  setEditingDateId(null);
                                }
                              }}
                              className="bg-surface-container-low border border-primary/60 rounded px-2 py-1 text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
                            />
                            <button
                              type="button"
                              title="บันทึกวันที่"
                              disabled={!/^\d{4}-\d{2}-\d{2}$/.test(editingDateVal)}
                              onClick={() => {
                                if (/^\d{4}-\d{2}-\d{2}$/.test(editingDateVal)) {
                                  updateTransactionDate(tx.id, editingDateVal);
                                  setEditingDateId(null);
                                }
                              }}
                              className="p-1 rounded text-primary hover:bg-primary-container/20 disabled:opacity-40"
                            >
                              <span className="material-symbols-outlined text-[16px]">check</span>
                            </button>
                            <button
                              type="button"
                              title="ยกเลิก"
                              onClick={() => setEditingDateId(null)}
                              className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container-high"
                            >
                              <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            title="แก้ไขวันที่"
                            onClick={() => {
                              setEditingDateId(tx.id);
                              setEditingDateVal(toDateInputValue(tx.date));
                            }}
                            className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 -ml-1.5 hover:bg-surface-container-high hover:text-on-surface transition-colors"
                          >
                            <span>{formatThaiDate(tx.date)}</span>
                            <span className="material-symbols-outlined text-[14px] text-outline">
                              edit_calendar
                            </span>
                          </button>
                        )}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-mono font-bold ${
                          tx.type === "income" ? "text-primary" : "text-secondary"
                        }`}
                      >
                        {tx.type === "income" ? "+" : "-"}
                        {formatTHB(tx.amount)}
                      </td>
                      <td className="py-3.5 pl-4 text-right">
                        <button
                          type="button"
                          onClick={() => deleteTransaction(tx.id)}
                          className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-surface-container-high"
                          title="ลบรายการ"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
