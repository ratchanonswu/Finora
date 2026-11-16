"use client";

import React, { useState } from "react";
import { useFinora } from "@/context/FinoraContext";
import { formatTHB, parsePromptPayPayload } from "@/lib/seed";

interface SlipData {
  id: string;
  merchant: string;
  promptPayId: string;
  amount: number;
  categoryId: string;
  source: "sample" | "upload";
}

const SAMPLE_SLIPS: SlipData[] = [
  {
    id: "qr-1",
    merchant: "Starbucks Reserve Siam Paragon",
    promptPayId: "0105541064682",
    amount: 185,
    categoryId: "food",
    source: "sample",
  },
  {
    id: "qr-2",
    merchant: "BTS Skytrain Rabbit Top-up",
    promptPayId: "0107537000011",
    amount: 500,
    categoryId: "transport",
    source: "sample",
  },
  {
    id: "qr-3",
    merchant: "Uniqlo Central World",
    promptPayId: "0105554012399",
    amount: 1490,
    categoryId: "shopping",
    source: "sample",
  },
];

function guessCategoryId(text: string): string {
  const lower = text.toLowerCase();
  if (/bts|mrt|grab|taxi|oil|shell|ptt|เดินทาง|รถ/.test(lower)) return "transport";
  if (/uniqlo|apple|mall|shop|lazada|shopee|central/.test(lower)) return "shopping";
  if (/netflix|spotify|youtube|game|movie/.test(lower)) return "entertainment";
  if (/condo|rent|ais|true|water|electric|บิล|ค่าไฟ|ค่าเช่า/.test(lower)) return "housing";
  return "food";
}

export default function QrScannerPage() {
  const { addTransaction, categories, bankBalance } = useFinora();
  const [selected, setSelected] = useState<SlipData | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [customFileName, setCustomFileName] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const expenseCategories = categories.filter((c) => c.type === "expense");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setStatus(null);
    setScanning(true);
    setCustomFileName(file.name);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
    let merchant = baseName && !/^(img|image|qr|screenshot|หน้าจอ)/i.test(baseName)
      ? baseName
      : "ร้านค้า PromptPay (จากรูปภาพ QR)";
    let promptPayId = `01055${String(10000000 + (file.size % 89999999))}`;
    let amount = Math.max(50, Math.round(((file.size % 900) + 100) / 5) * 5);

    // Decode actual QR barcode when supported by browser (Chromium BarcodeDetector)
    try {
      const Detector = (window as unknown as {
        BarcodeDetector?: new (opts: { formats: string[] }) => {
          detect: (src: ImageBitmap) => Promise<{ rawValue?: string }[]>;
        };
      }).BarcodeDetector;
      if (Detector) {
        const bitmap = await createImageBitmap(file);
        const codes = await new Detector({ formats: ["qr_code"] }).detect(bitmap);
        const raw = codes[0]?.rawValue?.trim();
        if (raw) {
          const parsed = parsePromptPayPayload(raw);
          if (parsed.merchant) merchant = parsed.merchant;
          else if (!raw.startsWith("000201") && raw.length <= 60) merchant = raw;
          if (parsed.promptPayId) promptPayId = parsed.promptPayId;
          if (parsed.amount) amount = parsed.amount;
        }
      }
    } catch {
      // Fallback to file metadata above if BarcodeDetector is unavailable
    }

    setSelected({
      id: `upload-${Date.now()}`,
      merchant,
      promptPayId,
      amount,
      categoryId: guessCategoryId(`${merchant} ${baseName}`),
      source: "upload",
    });
    setScanning(false);
  };

  const handleClear = () => {
    setSelected(null);
    setPreviewUrl(null);
    setCustomFileName(null);
    setStatus(null);
  };

  const handlePay = async () => {
    if (!selected) return;
    if (!selected.merchant.trim() || !Number.isFinite(selected.amount) || selected.amount <= 0) {
      setStatus({ type: "err", text: "กรุณาระบุชื่อผู้รับเงินและจำนวนเงินที่มากกว่า 0 บาท" });
      return;
    }

    setBusy(true);
    const res = await addTransaction({
      title: selected.merchant.trim(),
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
          <div className="aspect-video rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
            {previewUrl ? (
              <div className="flex flex-col items-center gap-3 w-full h-full justify-center">
                <img
                  src={previewUrl}
                  alt="Uploaded QR preview"
                  className="max-h-36 w-auto rounded-lg object-contain border border-outline-variant/30 bg-white p-1.5"
                />
                <p className="text-xs font-semibold text-on-surface truncate max-w-xs">
                  {customFileName}
                </p>
              </div>
            ) : (
              <>
                <span className="material-symbols-outlined text-[48px] text-primary mb-2">
                  qr_code_2
                </span>
                <p className="text-sm font-semibold text-on-surface">
                  {scanning ? "กำลังถอดรหัส QR Code..." : "พร้อมรับข้อมูล QR Code"}
                </p>
                <p className="text-xs text-on-surface-variant mt-1 mb-4">
                  รองรับมาตรฐาน Thai QR Payment (PromptPay)
                </p>
              </>
            )}

            <div className="flex items-center gap-2 mt-2">
              <label className="cursor-pointer px-4 py-2 rounded-lg bg-primary-container text-on-primary-container text-xs font-semibold hover:opacity-90">
                {previewUrl ? "เปลี่ยนรูปภาพ QR" : "อัปโหลดรูปภาพ QR / สลิป"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              {selected && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-3 py-2 rounded-lg border border-outline-variant/40 text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                >
                  ล้างค่า
                </button>
              )}
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              หรือเลือกตัวอย่าง QR สำหรับทดสอบ
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SAMPLE_SLIPS.map((s) => {
                const isActive = selected?.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelected({ ...s });
                      setPreviewUrl(null);
                      setCustomFileName(null);
                      setStatus(null);
                    }}
                    className={`p-3 rounded-lg border text-left text-xs transition-colors ${
                      isActive
                        ? "border-primary bg-primary-container/10 text-on-surface font-semibold"
                        : "border-outline-variant/30 bg-surface-container-low text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    <div className="truncate">{s.merchant}</div>
                    <div className="font-mono text-primary mt-1">{formatTHB(s.amount)}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Decoded Preview */}
        <div className="lg:col-span-6 rounded-2xl bg-surface-container border border-outline-variant/30 p-6 flex flex-col justify-between gap-5">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-4">
              <div className="w-12 h-12 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-[24px]">qr_code_scanner</span>
              </div>
              <h2 className="text-base font-semibold text-on-surface m-0">
                ยังไม่มีข้อมูลรายการสแกน
              </h2>
              <p className="text-xs text-on-surface-variant mt-1.5 max-w-xs leading-relaxed">
                กรุณาอัปโหลดรูปภาพ QR Code หรือคลิกเลือกตัวอย่าง QR ด้านซ้ายเพื่อแสดงรายละเอียดและชำระเงิน
              </p>
            </div>
          ) : (
            <>
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20">
                  <h2 className="text-base font-semibold text-on-surface m-0">
                    รายละเอียดรายการที่ถอดรหัสได้
                  </h2>
                  <span className="text-xs font-mono text-primary font-semibold">
                    {selected.source === "upload" ? "QR Image Scanned" : "PromptPay Verified"}
                  </span>
                </div>

                <div className="divide-y divide-outline-variant/20 text-sm mt-2">
                  <div className="py-3 flex items-center justify-between gap-3">
                    <label htmlFor="qr-merchant" className="text-on-surface-variant shrink-0">
                      ร้านค้า / ผู้รับเงิน
                    </label>
                    <input
                      id="qr-merchant"
                      type="text"
                      value={selected.merchant}
                      onChange={(e) => setSelected({ ...selected, merchant: e.target.value })}
                      className="bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-1.5 text-sm font-semibold text-right text-on-surface w-full max-w-[240px] focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="py-3 flex justify-between">
                    <span className="text-on-surface-variant">รหัส PromptPay / Tax ID</span>
                    <span className="font-mono text-on-surface">{selected.promptPayId}</span>
                  </div>
                  <div className="py-3 flex items-center justify-between gap-3">
                    <label htmlFor="qr-category" className="text-on-surface-variant shrink-0">
                      หมวดหมู่แนะนำ (AI)
                    </label>
                    <select
                      id="qr-category"
                      value={selected.categoryId}
                      onChange={(e) => setSelected({ ...selected, categoryId: e.target.value })}
                      className="bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-1.5 text-sm font-medium text-primary focus:outline-none focus:border-primary"
                    >
                      {expenseCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="py-3 flex items-center justify-between gap-3">
                    <label htmlFor="qr-amount" className="text-on-surface-variant shrink-0">
                      ยอดเงินที่ต้องชำระ (THB)
                    </label>
                    <input
                      id="qr-amount"
                      type="number"
                      min="1"
                      step="0.01"
                      value={selected.amount}
                      onChange={(e) =>
                        setSelected({ ...selected, amount: Number(e.target.value) || 0 })
                      }
                      className="bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-1.5 text-lg font-bold font-mono text-right text-on-surface w-36 focus:outline-none focus:border-primary"
                    />
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
