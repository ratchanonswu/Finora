"use client";

import React, { useState } from "react";
import { useFinora } from "@/context/FinoraContext";
import { formatTHB } from "@/lib/seed";

const SAMPLE_SLIPS = [
  {
    id: "qr-1",
    merchant: "Starbucks Reserve Siam Paragon",
    promptPayId: "0105541064682",
    amount: 185,
    categoryId: "food",
  },
  {
    id: "qr-2",
    merchant: "BTS Skytrain Rabbit Top-up",
    promptPayId: "0107537000011",
    amount: 500,
    categoryId: "transport",
  },
  {
    id: "qr-3",
    merchant: "Uniqlo Central World",
    promptPayId: "0105554012399",
    amount: 1490,
    categoryId: "shopping",
  },
];

export default function QrScannerPage() {
  const { addTransaction, categories, bankBalance } = useFinora();
  const [selected, setSelected] = useState(SAMPLE_SLIPS[0]);
  const [customFileName, setCustomFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCustomFileName(file.name);
    // Pick a deterministic sample slip preview when user uploads a test image
    setSelected(SAMPLE_SLIPS[file.size % SAMPLE_SLIPS.length]);
    setStatus(null);
  };

  const handlePay = async () => {
    setBusy(true);
    const res = await addTransaction({
      title: selected.merchant,
      amount: selected.amount,
      type: "expense",
      categoryId: selected.categoryId,
      channel: "สแกน PromptPay QR",
      date: new Date().toISOString(),
    });
    setBusy(false);

    if (!res.ok) {
      setStatus({ type: "err", text: res.error || "ไม่สามารถชำระเงินได้" });
      return;
    }

    setStatus({
      type: "ok",
      text: `ชำระเงิน ${formatTHB(selected.amount)} ให้ ${selected.merchant} และบันทึกธุรกรรมเรียบร้อยแล้ว`,
    });
  };

  const catName = categories.find((c) => c.id === selected.categoryId)?.name || selected.categoryId;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface tracking-tight m-0">
          สแกน PromptPay QR Code
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          อัปโหลดรูปภาพสลิป/QR หรือเลือกตัวอย่าง QR เพื่อทดสอบการถอดรหัสและชำระเงินผ่าน Virtual Bank
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Scanner / Upload */}
        <div className="lg:col-span-6 rounded-2xl bg-surface-container border border-outline-variant/30 p-6 flex flex-col gap-5">
          <div className="aspect-video rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex flex-col items-center justify-center p-6 text-center">
            <span className="material-symbols-outlined text-[48px] text-primary mb-2">
              qr_code_2
            </span>
            <p className="text-sm font-semibold text-on-surface">
              {customFileName ? `ไฟล์ที่เลือก: ${customFileName}` : "พร้อมรับข้อมูล QR Code"}
            </p>
            <p className="text-xs text-on-surface-variant mt-1 mb-4">
              รองรับมาตรฐาน Thai QR Payment (PromptPay)
            </p>
            <label className="cursor-pointer px-4 py-2 rounded-lg bg-primary-container text-on-primary-container text-xs font-semibold hover:opacity-90">
              อัปโหลดรูปภาพ QR / สลิป
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>
          </div>

          <div>
            <span className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              หรือเลือกตัวอย่าง QR สำหรับทดสอบ
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SAMPLE_SLIPS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelected(s);
                    setCustomFileName(null);
                    setStatus(null);
                  }}
                  className={`p-3 rounded-lg border text-left text-xs transition-colors ${
                    selected.id === s.id
                      ? "border-primary bg-primary-container/10 text-on-surface font-semibold"
                      : "border-outline-variant/30 bg-surface-container-low text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  <div className="truncate">{s.merchant}</div>
                  <div className="font-mono text-primary mt-1">{formatTHB(s.amount)}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Decoded Preview */}
        <div className="lg:col-span-6 rounded-2xl bg-surface-container border border-outline-variant/30 p-6 flex flex-col justify-between gap-5">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20">
              <h2 className="text-base font-semibold text-on-surface m-0">
                รายละเอียดรายการที่ถอดรหัสได้
              </h2>
              <span className="text-xs font-mono text-primary font-semibold">PromptPay Verified</span>
            </div>

            <div className="divide-y divide-outline-variant/20 text-sm mt-2">
              <div className="py-3 flex justify-between">
                <span className="text-on-surface-variant">ร้านค้า / ผู้รับเงิน</span>
                <span className="font-semibold text-on-surface">{selected.merchant}</span>
              </div>
              <div className="py-3 flex justify-between">
                <span className="text-on-surface-variant">รหัส PromptPay / Tax ID</span>
                <span className="font-mono text-on-surface">{selected.promptPayId}</span>
              </div>
              <div className="py-3 flex justify-between">
                <span className="text-on-surface-variant">หมวดหมู่แนะนำ (AI)</span>
                <span className="font-medium text-primary">{catName}</span>
              </div>
              <div className="py-3 flex justify-between">
                <span className="text-on-surface-variant">ยอดเงินที่ต้องชำระ</span>
                <span className="text-xl font-bold font-mono text-on-surface">
                  {formatTHB(selected.amount)}
                </span>
              </div>
              <div className="py-3 flex justify-between text-xs">
                <span className="text-on-surface-variant">ยอดเงินคงเหลือใน Virtual Wallet</span>
                <span className="font-mono text-on-surface">{formatTHB(bankBalance)}</span>
              </div>
            </div>
          </div>

          {status && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                status.type === "ok"
                  ? "border-primary/40 bg-primary-container/15 text-primary"
                  : "border-error/40 bg-error-container/20 text-on-error-container"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {status.type === "ok" ? "check_circle" : "error"}
              </span>
              <span>{status.text}</span>
            </div>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={handlePay}
            className="w-full py-3 rounded-lg bg-primary-container text-on-primary-container text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">payments</span>
            <span>{busy ? "กำลังดำเนินการ..." : "ยืนยันชำระเงินผ่าน Virtual Bank"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
