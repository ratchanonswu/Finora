"use client";

import React, { useRef, useState } from "react";
import { useFinora } from "@/context/FinoraContext";
import { formatTHB, formatThaiDate } from "@/lib/seed";
import { useDialogAccessibility } from "@/lib/useDialogAccessibility";

export default function VirtualBankPage() {
  const { bankBalance, ledger, executeBankAction } = useFinora();
  const [actionType, setActionType] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState<"all" | "credit" | "debit">("all");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const confirmDialogRef = useRef<HTMLDivElement | null>(null);

  useDialogAccessibility(confirmOpen, confirmDialogRef, () => setConfirmOpen(false), !loading);

  const parsedAmount = Number(amount);

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFeedback({ type: "err", text: "กรุณาระบุจำนวนเงินที่มากกว่า 0 บาท" });
      return;
    }
    setFeedback(null);
    setConfirmOpen(true);
  };

  const handleConfirmExecute = async () => {
    setLoading(true);
    const res = await executeBankAction(
      actionType,
      parsedAmount,
      title.trim() || (actionType === "credit" ? "เติมเงินเข้าบัญชี" : "โอนเงินออก"),
      counterparty.trim() || "Finora Sandbox"
    );
    setLoading(false);
    setConfirmOpen(false);

    if (!res.ok) {
      setFeedback({ type: "err", text: res.error || "ไม่สามารถทำรายการได้" });
      return;
    }

    setFeedback({
      type: "ok",
      text: `ทำรายการ${actionType === "credit" ? "ฝาก/รับเงิน" : "โอน/ชำระเงิน"} ${formatTHB(parsedAmount)} สำเร็จ`,
    });
    setAmount("");
    setTitle("");
    setCounterparty("");
  };

  const visibleLedger = ledger.filter((l) => filter === "all" || l.type === filter);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface tracking-tight m-0">
          ธนาคารจำลอง (Finora Virtual Bank)
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          จำลองการฝาก โอน และตรวจสอบรายการเดินบัญชีแบบเรียลไทม์อย่างปลอดภัย
        </p>
      </div>

      {feedback && (
        <div
          role={feedback.type === "ok" ? "status" : "alert"}
          className={`p-3.5 rounded-xl border text-sm flex items-center gap-2 ${
            feedback.type === "ok"
              ? "border-primary/40 bg-primary-container/15 text-primary"
              : "border-error/40 bg-error-container/20 text-on-error-container"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {feedback.type === "ok" ? "check_circle" : "error"}
          </span>
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Account Overview & Quick Action Form */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="rounded-2xl bg-surface-container border border-outline-variant/30 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Finora Virtual Wallet
              </span>
              <span className="text-xs font-mono text-primary font-semibold">พร้อมใช้งาน</span>
            </div>
            <div
              className={`text-3xl font-bold font-mono tracking-tight ${
                bankBalance < 0 ? "text-secondary" : "text-on-surface"
              }`}
            >
              {formatTHB(bankBalance)}
            </div>
            <div className="mt-4 pt-4 border-t border-outline-variant/20 flex items-center justify-between text-xs text-on-surface-variant">
              <span>เลขที่บัญชี: 782-2-90145-8</span>
              <span>THB Savings</span>
            </div>
          </div>

          <form
            onSubmit={handleOpenConfirm}
            className="rounded-2xl bg-surface-container border border-outline-variant/30 p-6 space-y-4"
          >
            <h2 className="text-base font-semibold text-on-surface m-0">จำลองธุรกรรมบัญชี</h2>

            <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-surface-container-low">
              <button
                type="button"
                onClick={() => setActionType("credit")}
                className={`py-2 rounded-md text-xs font-semibold ${
                  actionType === "credit"
                    ? "bg-primary-container text-on-primary-container"
                    : "text-on-surface-variant"
                }`}
              >
                เติมเงิน / รับเงิน (+)
              </button>
              <button
                type="button"
                onClick={() => setActionType("debit")}
                className={`py-2 rounded-md text-xs font-semibold ${
                  actionType === "debit"
                    ? "bg-secondary text-on-secondary"
                    : "text-on-surface-variant"
                }`}
              >
                โอนออก / จ่ายเงิน (-)
              </button>
            </div>

            <div>
              <label
                htmlFor="vb-amount"
                className="block text-xs font-semibold text-on-surface-variant mb-1"
              >
                จำนวนเงิน (THB)
              </label>
              <input
                id="vb-amount"
                type="number"
                step="0.01"
                min="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1,000.00"
                className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2.5 text-sm font-mono text-on-surface focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
              />
            </div>

            <div>
              <label
                htmlFor="vb-counterparty"
                className="block text-xs font-semibold text-on-surface-variant mb-1"
              >
                {actionType === "credit" ? "แหล่งที่มาของเงิน" : "บัญชีปลายทาง / ผู้รับเงิน"}
              </label>
              <input
                id="vb-counterparty"
                type="text"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder={actionType === "credit" ? "เช่น SCB Easy, เงินเดือน" : "เช่น KBank, ร้านค้า"}
                className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
              />
            </div>

            <div>
              <label
                htmlFor="vb-title"
                className="block text-xs font-semibold text-on-surface-variant mb-1"
              >
                บันทึกช่วยจำ
              </label>
              <input
                id="vb-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="รายละเอียดรายการ"
                className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-primary-container text-on-primary-container text-sm font-semibold hover:opacity-90"
            >
              ตรวจสอบและยืนยันรายการ
            </button>
          </form>
        </div>

        {/* Ledger History */}
        <div className="lg:col-span-7 rounded-2xl bg-surface-container border border-outline-variant/30 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-base font-semibold text-on-surface m-0">รายการเดินบัญชี (Ledger)</h2>
            <div className="flex items-center gap-1.5 text-xs">
              {(["all", "credit", "debit"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-md font-medium ${
                    filter === f
                      ? "bg-primary-container text-on-primary-container"
                      : "bg-surface-container-low text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {f === "all" ? "ทั้งหมด" : f === "credit" ? "เงินเข้า" : "เงินออก"}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-outline-variant/20">
            {visibleLedger.map((entry) => (
              <div key={entry.id} className="py-3.5 flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-sm text-on-surface">{entry.title}</div>
                  <div className="text-xs text-on-surface-variant mt-0.5">
                    {entry.counterparty} • <span className="font-mono">{entry.ref}</span> •{" "}
                    {formatThaiDate(entry.date)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={`font-mono font-bold text-sm ${
                      entry.type === "credit" ? "text-primary" : "text-secondary"
                    }`}
                  >
                    {entry.type === "credit" ? "+" : "-"}
                    {formatTHB(entry.amount)}
                  </div>
                  <div className="text-[11px] font-mono text-outline">
                    คงเหลือ {formatTHB(entry.balanceAfter)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-backdrop-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vb-confirm-title"
          onClick={() => {
            if (!loading) setConfirmOpen(false);
          }}
        >
          <div
            ref={confirmDialogRef}
            tabIndex={-1}
            className="w-full max-w-md rounded-xl bg-surface-container border border-outline-variant/40 p-6 shadow-2xl space-y-4 animate-modal-in focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="vb-confirm-title" className="text-lg font-bold text-on-surface m-0">
              ยืนยันการทำรายการ
            </h3>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              คุณต้องการ{actionType === "credit" ? "เติมเงินเข้าบัญชี" : "โอนเงินออกจากบัญชี"}จำนวน{" "}
              <strong className="text-on-surface font-mono">{formatTHB(parsedAmount)}</strong>{" "}
              {counterparty ? `(${counterparty})` : ""} ใช่หรือไม่?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 rounded-lg text-sm text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmExecute}
                className="px-5 py-2 rounded-lg bg-primary-container text-on-primary-container text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "กำลังดำเนินการ..." : "ยืนยันรายการ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
