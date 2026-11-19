"use client";

import React, { useState } from "react";
import { useFinora } from "@/context/FinoraContext";
import type { TransactionType } from "@/lib/types";

export function TransactionModal() {
  const { isTxModalOpen, setTxModalOpen, categories, addTransaction } = useFinora();
  const [type, setType] = useState<TransactionType>("expense");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("food");
  const [channel, setChannel] = useState("Virtual Bank Wallet");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isTxModalOpen) return null;

  const filteredCategories = categories.filter(
    (c) => c.type === type && c.id !== "recurring"
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Number(amount);
    if (!title.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("กรุณากรอกชื่อรายการและจำนวนเงินที่มากกว่า 0");
      return;
    }

    setError("");
    setSubmitting(true);
    const res = await addTransaction({
      title: title.trim(),
      amount: parsedAmount,
      type,
      categoryId: filteredCategories.some((c) => c.id === categoryId)
        ? categoryId
        : filteredCategories[0]?.id || "food",
      channel,
      date: new Date().toISOString(),
    });
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error || "ไม่สามารถบันทึกรายการได้");
      return;
    }

    setTitle("");
    setAmount("");
    setTxModalOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-backdrop-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl bg-surface-container border border-outline-variant/40 shadow-2xl overflow-hidden animate-modal-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-[22px]">add_circle</span>
            <h2 id="tx-modal-title" className="text-lg font-semibold text-on-surface m-0">
              บันทึกธุรกรรมใหม่
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setTxModalOpen(false)}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
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
                setCategoryId("food");
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
                setCategoryId("salary");
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
            <div className="p-3 rounded-lg border border-error/40 bg-error-container/20 text-on-error-container text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-error">error</span>
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
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary"
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
                className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2.5 text-sm font-mono text-on-surface focus:outline-none focus:border-primary"
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
                className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary"
              >
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="tx-channel" className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">
              ช่องทาง / บัญชี
            </label>
            <select
              id="tx-channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary"
            >
              <option value="Virtual Bank Wallet">Virtual Bank Wallet</option>
              <option value="สแกน PromptPay QR">สแกน PromptPay QR</option>
              <option value="Virtual Card">Virtual Card</option>
              <option value="เงินสด">เงินสด</option>
            </select>
          </div>

          <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setTxModalOpen(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-primary-container text-on-primary-container text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "กำลังบันทึก..." : "บันทึกรายการ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
