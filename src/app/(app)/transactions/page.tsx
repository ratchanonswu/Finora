"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useFinora } from "@/context/FinoraContext";
import { formatTHB, formatThaiDate, toDateInputValue } from "@/lib/seed";
import type { Transaction } from "@/lib/types";

type SortOrder = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

const PAGE_SIZE = 15;

export default function TransactionsPage() {
  const {
    transactions,
    categories,
    settings,
    setTxModalOpen,
    openEditTransaction,
    deleteTransaction,
    updateTransactionDate,
  } = useFinora();

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [catFilter, setCatFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortOrder>("date_desc");
  const [page, setPage] = useState(1);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [editingDateVal, setEditingDateVal] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  const hasActiveFilters =
    query.trim().length > 0 || typeFilter !== "all" || catFilter !== "all";

  const resetFilters = () => {
    setQuery("");
    setTypeFilter("all");
    setCatFilter("all");
    setPage(1);
  };

  const filtered = useMemo(() => {
    const matched = transactions.filter((tx) => {
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

    if (sortBy === "date_desc") return matched;

    return [...matched].sort((a, b) => {
      if (sortBy === "date_asc") {
        const dayDiff = toDateInputValue(a.date).localeCompare(toDateInputValue(b.date));
        if (dayDiff !== 0) return dayDiff;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      if (sortBy === "amount_desc") return b.amount - a.amount;
      return a.amount - b.amount;
    });
  }, [transactions, typeFilter, catFilter, query, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    await deleteTransaction(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
  };

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
      <div className="rounded-xl bg-surface-container border border-outline-variant/30 p-4 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
            search
          </span>
          <input
            type="text"
            aria-label="ค้นหารายการธุรกรรม"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="ค้นหาชื่อรายการ, เลขอ้างอิง, ช่องทาง..."
            className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg pl-9 pr-4 py-2 text-sm text-on-surface focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:flex gap-2.5">
          <select
            aria-label="กรองตามประเภทรายการ"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as "all" | "income" | "expense");
              setPage(1);
            }}
            className="bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2 text-sm text-on-surface focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            <option value="all">ทุกประเภท</option>
            <option value="income">รายรับ (Income)</option>
            <option value="expense">รายจ่าย (Expense)</option>
          </select>

          <select
            aria-label="กรองตามหมวดหมู่"
            value={catFilter}
            onChange={(e) => {
              setCatFilter(e.target.value);
              setPage(1);
            }}
            className="bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2 text-sm text-on-surface focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            <option value="all">ทุกหมวดหมู่</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            aria-label="เรียงลำดับรายการ"
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as SortOrder);
              setPage(1);
            }}
            className="bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2 text-sm text-on-surface focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            <option value="date_desc">วันที่: ใหม่ → เก่า</option>
            <option value="date_asc">วันที่: เก่า → ใหม่</option>
            <option value="amount_desc">จำนวนเงิน: มาก → น้อย</option>
            <option value="amount_asc">จำนวนเงิน: น้อย → มาก</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-outline-variant/40 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">filter_alt_off</span>
              <span>ล้างตัวกรอง</span>
            </button>
          )}
        </div>
      </div>

      {/* Transactions List */}
      <div className="rounded-2xl bg-surface-container border border-outline-variant/30 p-4 sm:p-6">
        {filtered.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <span className="material-symbols-outlined text-[32px] text-outline">
              receipt_long
            </span>
            <p className="text-sm text-on-surface-variant">
              {hasActiveFilters
                ? "ไม่พบรายการธุรกรรมที่ตรงกับเงื่อนไขการค้นหา"
                : "ยังไม่มีรายการธุรกรรมในระบบ"}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-outline-variant/40 text-xs font-semibold text-primary hover:bg-surface-container-high transition-colors"
              >
                ล้างตัวกรองทั้งหมด
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-outline-variant/20">
              {paged.map((tx) => {
                const cat = categories.find((c) => c.id === tx.categoryId);
                return (
                  <div key={tx.id} className="py-3.5 first:pt-1 last:pb-1 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-on-surface truncate">
                          {tx.title}
                        </div>
                        <div className="text-[11px] font-mono text-outline">{tx.ref}</div>
                      </div>
                      <div
                        className={`font-mono font-bold text-sm shrink-0 ${
                          tx.type === "income" ? "text-primary" : "text-secondary"
                        }`}
                      >
                        {tx.type === "income" ? "+" : "-"}
                        {formatTHB(tx.amount)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="inline-flex items-center gap-1.5">
                          {cat?.color && (
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                          )}
                          <span>{cat?.name || tx.categoryId}</span>
                        </span>
                        <span>•</span>
                        <span>{tx.channel}</span>
                        <span>•</span>
                        <span className="font-mono">{formatThaiDate(tx.date)}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditTransaction(tx)}
                          aria-label={`แก้ไขรายการ ${tx.title}`}
                          title="แก้ไขรายการ"
                          className="p-2 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(tx)}
                          aria-label={`ลบรายการ ${tx.title}`}
                          title="ลบรายการ"
                          className="p-2 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
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
                  {paged.map((tx) => {
                    const cat = categories.find((c) => c.id === tx.categoryId);
                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-surface-container-low/50 transition-colors duration-150"
                      >
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
                        <td className="py-3.5 px-4 text-xs text-on-surface-variant">
                          {tx.channel}
                        </td>
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
                                  if (
                                    e.key === "Enter" &&
                                    /^\d{4}-\d{2}-\d{2}$/.test(editingDateVal)
                                  ) {
                                    updateTransactionDate(tx.id, editingDateVal);
                                    setEditingDateId(null);
                                  } else if (e.key === "Escape") {
                                    setEditingDateId(null);
                                  }
                                }}
                                className="bg-surface-container-low border border-primary/60 rounded px-2 py-1 text-xs font-mono text-on-surface focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
                              />
                              <button
                                type="button"
                                aria-label="บันทึกวันที่"
                                title="บันทึกวันที่"
                                disabled={!/^\d{4}-\d{2}-\d{2}$/.test(editingDateVal)}
                                onClick={() => {
                                  if (/^\d{4}-\d{2}-\d{2}$/.test(editingDateVal)) {
                                    updateTransactionDate(tx.id, editingDateVal);
                                    setEditingDateId(null);
                                  }
                                }}
                                className="p-1.5 rounded text-primary hover:bg-primary-container/20 disabled:opacity-40"
                              >
                                <span className="material-symbols-outlined text-[16px]">check</span>
                              </button>
                              <button
                                type="button"
                                aria-label="ยกเลิกแก้ไขวันที่"
                                title="ยกเลิก"
                                onClick={() => setEditingDateId(null)}
                                className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                              >
                                <span className="material-symbols-outlined text-[16px]">close</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              aria-label={`แก้ไขวันที่ของ ${tx.title}`}
                              title="แก้ไขวันที่"
                              onClick={() => {
                                setEditingDateId(tx.id);
                                setEditingDateVal(toDateInputValue(tx.date));
                              }}
                              className="inline-flex items-center gap-1.5 rounded px-2 py-1 -ml-2 hover:bg-surface-container-high hover:text-on-surface transition-colors"
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
                        <td className="py-3.5 pl-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditTransaction(tx)}
                              aria-label={`แก้ไขรายการ ${tx.title}`}
                              title="แก้ไขรายการ"
                              className="p-2 rounded-lg text-outline hover:text-primary hover:bg-surface-container-high transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(tx)}
                              aria-label={`ลบรายการ ${tx.title}`}
                              title="ลบรายการ"
                              className="p-2 rounded-lg text-outline hover:text-error hover:bg-error/10 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 pt-4 border-t border-outline-variant/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-on-surface-variant">
                <span>
                  แสดง {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, filtered.length)} จาก {filtered.length} รายการ
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg border border-outline-variant/40 font-semibold hover:bg-surface-container-high disabled:opacity-40"
                  >
                    ก่อนหน้า
                  </button>
                  <span className="font-mono px-2">
                    หน้า {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg border border-outline-variant/40 font-semibold hover:bg-surface-container-high disabled:opacity-40"
                  >
                    ถัดไป
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="ต้องการลบรายการธุรกรรมนี้ใช่ไหม?"
        description={
          deleteTarget
            ? `รายการ "${deleteTarget.title}" (${formatTHB(deleteTarget.amount)}) จะถูกลบออกจากประวัติ${
                settings.autoDebitOnExpense
                  ? " และระบบจะปรับคืนยอดใน Virtual Wallet ให้โดยอัตโนมัติ"
                  : ""
              }`
            : ""
        }
        confirmLabel="ยืนยันลบรายการ"
        icon="delete"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
