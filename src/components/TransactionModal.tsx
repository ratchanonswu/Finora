"use client";

import React, { useEffect, useRef, useState } from "react";
import { useFinora } from "@/context/FinoraContext";
import { toDateInputValue, todayYmd, ymdToIso } from "@/lib/seed";
import { useDialogAccessibility } from "@/lib/useDialogAccessibility";
import type { TransactionType } from "@/lib/types";

const BASE_CHANNELS = [
  "Virtual Bank Wallet",
  "สแกน PromptPay QR",
  "Virtual Card",
  "เงินสด",
];

export function TransactionModal() {
  const {
    isTxModalOpen,
    setTxModalOpen,
    editingTransaction,
    categories,
    addTransaction,
    updateTransaction,
  } = useFinora();
  const [type, setType] = useState<TransactionType>("expense");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("food");
  const [channel, setChannel] = useState("Virtual Bank Wallet");
  const [date, setDate] = useState<string>(() => todayYmd());
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const isEditing = Boolean(editingTransaction);

  useEffect(() => {
    if (!isTxModalOpen) return;
    setError("");
    if (editingTransaction) {
      setType(editingTransaction.type);
      setTitle(editingTransaction.title);
      setAmount(String(editingTransaction.amount));
      setCategoryId(editingTransaction.categoryId);
      setChannel(editingTransaction.channel || "Virtual Bank Wallet");
      setDate(toDateInputValue(editingTransaction.date) || todayYmd());
    } else {
      setType("expense");
      setTitle("");
      setAmount("");
      setCategoryId("food");
      setChannel("Virtual Bank Wallet");
      setDate(todayYmd());
    }
  }, [isTxModalOpen, editingTransaction]);

  useDialogAccessibility(
    isTxModalOpen,
    dialogRef,
    () => setTxModalOpen(false),
    !submitting
  );

  if (!isTxModalOpen) return null;

  const filteredCategories = categories.filter(
    (c) => c.type === type && c.id !== "recurring"
  );
  const channelOptions = BASE_CHANNELS.includes(channel)
    ? BASE_CHANNELS
    : [channel, ...BASE_CHANNELS];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Number(amount);
    if (!title.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("กรุณากรอกชื่อรายการและจำนวนเงินที่มากกว่า 0");
      return;
    }

    setError("");
    setSubmitting(true);
    const payload = {
      title: title.trim(),
      amount: parsedAmount,
      type,
      categoryId: filteredCategories.some((c) => c.id === categoryId)
        ? categoryId
        : filteredCategories[0]?.id || (type === "income" ? "salary" : "food"),
      channel,
      date: ymdToIso(date),
    };
    const res = editingTransaction
      ? await updateTransaction(editingTransaction.id, payload)
      : await addTransaction(payload);
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error || "ไม่สามารถบันทึกรายการได้");
      return;
    }

    setTxModalOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-backdrop-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-modal-title"
      onClick={() => {
        if (!submitting) setTxModalOpen(false);
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-lg rounded-xl bg-surface-container border border-outline-variant/40 shadow-2xl overflow-hidden animate-modal-in focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-[22px]">
              {isEditing ? "edit" : "add_circle"}
            </span>
            <h2 id="tx-modal-title" className="text-lg font-semibold text-on-surface m-0">
              {isEditing ? "แก้ไขรายการธุรกรรม" : "บันทึกธุรกรรมใหม่"}
            </h2>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={() => setTxModalOpen(false)}
            className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high disabled:opacity-40"
            aria-label="ปิดหน้าต่าง"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-surface-container-low">
            <button
              type="button"
              onClick={() => {
                setType("expense");
                setCategoryId(
                  categories.find((c) => c.type === "expense" && c.id !== "recurring")?.id || "food"
                );
              }}
              className={`py-2 rounded-md text-sm font-semibold transition-colors ${
                type === "expense"
                  ? "bg-secondary text-on-secondary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              รายจ่าย (Expense)
            </button>
            <button
              type="button"
              onClick={() => {
                setType("income");
                setCategoryId(
                  categories.find((c) => c.type === "income" && c.id !== "recurring")?.id || "salary"
                );
              }}
              className={`py-2 rounded-md text-sm font-semibold transition-colors ${
                type === "income"
                  ? "bg-primary-container text-on-primary-container shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              รายรับ (Income)
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-lg border border-error/40 bg-error-container/20 text-on-error-container text-xs flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px] text-error shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="tx-title" className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">
              ชื่อรายการ
            </label>
            <input
              id="tx-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น กาแฟ Starbucks, เงินเดือน, ค่าอินเทอร์เน็ต"
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="tx-amount" className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">
                จำนวนเงิน (THB)
              </label>
              <input
                id="tx-amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2.5 text-sm font-mono text-on-surface focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
              />
            </div>

            <div>
              <label htmlFor="tx-cat" className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">
                หมวดหมู่
              </label>
              <select
                id="tx-cat"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
              >
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="tx-channel" className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">
                ช่องทาง / บัญชี
              </label>
              <select
                id="tx-channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
              >
                {channelOptions.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tx-date" className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">
                วันที่ทำรายการ
              </label>
              <input
                id="tx-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2.5 text-sm font-mono text-on-surface focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setTxModalOpen(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high disabled:opacity-40"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-primary-container text-on-primary-container text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "กำลังบันทึก..." : isEditing ? "บันทึกการแก้ไข" : "บันทึกรายการ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
