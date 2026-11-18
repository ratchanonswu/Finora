"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useFinora, type MonthlyRolloverResult } from "@/context/FinoraContext";
import { formatTHB } from "@/lib/seed";

export default function SettingsPage() {
  const router = useRouter();
  const {
    theme,
    toggleTheme,
    user,
    updateUser,
    settings,
    updateSettings,
    bankBalance,
    logoutUser,
    runMonthlyRollover,
  } = useFinora();

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [geminiKey, setGeminiKey] = useState(settings.geminiApiKeyOverride);
  const [savedNotice, setSavedNotice] = useState(false);
  const [rolloverResult, setRolloverResult] = useState<MonthlyRolloverResult | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser({ name: name.trim() || user.name, email: email.trim() || user.email });
    updateSettings({ geminiApiKeyOverride: geminiKey.trim() });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleTestRollover = () => {
    const res = runMonthlyRollover();
    setRolloverResult(res);
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-8 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight m-0">ตั้งค่าระบบ</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            จัดการข้อมูลบัญชีผู้ใช้ ธีมการแสดงผล บัญชีการเงินที่เชื่อมต่อ และการตั้งค่า AI
          </p>
        </div>
        <button
          type="submit"
          className="px-5 py-2.5 rounded-lg bg-primary-container text-on-primary-container text-sm font-semibold hover:opacity-90 shadow-sm self-start"
        >
          {savedNotice ? "บันทึกเรียบร้อยแล้ว ✓" : "บันทึกการตั้งค่า"}
        </button>
      </div>

      {/* Section 1: User Profile */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-on-surface m-0">ข้อมูลบัญชีผู้ใช้ (Profile)</h2>
        <div className="rounded-xl bg-surface-container border border-outline-variant/30 p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
              ชื่อ-นามสกุล
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2.5 text-sm text-on-surface"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
              อีเมล
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2.5 text-sm text-on-surface"
            />
          </div>
        </div>
      </section>

      {/* Section 2: Appearance / Dual Theme */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-on-surface m-0">รูปแบบการแสดงผล (Theme)</h2>
        <div className="rounded-xl bg-surface-container border border-outline-variant/30 p-5 flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-sm text-on-surface">
              {theme === "light" ? "Light Fintech Theme (ค่าเริ่มต้น)" : "Emerald Nocturne (Dark Mode)"}
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              สลับระหว่างธีมสว่างสบายตาและธีมมืด Emerald Nocturne ได้ทันที
            </p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="px-4 py-2 rounded-lg bg-surface-container-high border border-outline-variant/40 text-xs font-semibold text-on-surface hover:bg-surface-container-highest"
          >
            สลับเป็น {theme === "light" ? "Dark Mode" : "Light Mode"}
          </button>
        </div>
      </section>

      {/* Section 3: Linked Accounts & Payment Preferences (Consumer View) */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-on-surface m-0">
          บัญชีธนาคารและกระเป๋าเงิน (Linked Accounts)
        </h2>
        <div className="rounded-xl bg-surface-container border border-outline-variant/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-on-surface">Finora Virtual Wallet</span>
              <span className="px-2 py-0.5 rounded-full bg-primary-container/20 text-primary text-[10px] font-bold">
                บัญชีหลัก
              </span>
            </div>
            <p className="text-xs font-mono text-on-surface-variant mt-1">
              เลขที่บัญชี: 782-2-90145-8 • พร้อมใช้งาน
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-outline block">ยอดเงินคงเหลือ</span>
            <span className="font-mono font-bold text-primary">{formatTHB(bankBalance)}</span>
          </div>
        </div>

        <div className="rounded-xl bg-surface-container border border-outline-variant/30 divide-y divide-outline-variant/20">
          <label className="p-4 flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <div className="text-sm font-semibold text-on-surface">
                ตัดเงินจากกระเป๋าเงินอัตโนมัติเมื่อบันทึกรายจ่าย
              </div>
              <div className="text-xs text-on-surface-variant">
                หักยอดคงเหลือใน Finora Virtual Wallet ทันทีที่มีการบันทึกหรือสแกนจ่าย
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.autoDebitOnExpense}
              onChange={(e) => updateSettings({ autoDebitOnExpense: e.target.checked })}
              className="w-4 h-4 accent-primary"
            />
          </label>

          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <label
                htmlFor="monthly-salary-input"
                className="text-sm font-semibold text-on-surface block"
              >
                เงินเดือนประจำ (THB)
              </label>
              <div className="text-xs text-on-surface-variant">
                เติมเข้า Finora Virtual Wallet อัตโนมัติเมื่อครบรอบเดือน
              </div>
            </div>
            <input
              id="monthly-salary-input"
              type="number"
              min="0"
              value={settings.monthlySalary}
              onChange={(e) =>
                updateSettings({ monthlySalary: Math.max(0, Number(e.target.value) || 0) })
              }
              className="w-40 bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm font-mono text-right text-on-surface"
            />
          </div>

          <div className="p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-on-surface">
                  ทดสอบครบรอบเดือน (Test Monthly Rollover)
                </div>
                <div className="text-xs text-on-surface-variant">
                  จำลองครบรอบเดือน: เติมเงินเดือน ตัดบิล Recurring ที่เปิดใช้งาน และรีเซ็ตโควต้าหมวดหมู่เป็น ฿0
                </div>
              </div>
              <button
                type="button"
                onClick={handleTestRollover}
                className="px-4 py-2 rounded-lg bg-primary-container text-on-primary-container text-xs font-semibold hover:opacity-90 shrink-0 self-start sm:self-center"
              >
                รันครบรอบเดือนจำลอง (Test)
              </button>
            </div>
            {rolloverResult && (
              <div
                role="status"
                className="text-xs text-primary bg-primary-container/15 border border-primary/30 rounded-lg px-3.5 py-2.5 font-medium"
              >
                ทดสอบครบรอบเดือนสำเร็จ: เติมเงินเดือน +{formatTHB(rolloverResult.salaryCredited)}
                {rolloverResult.recurringIncomeCount > 0
                  ? ` • รับรายรับประจำ ${rolloverResult.recurringIncomeCount} รายการ (+${formatTHB(rolloverResult.recurringIncomeTotal)})`
                  : ""}
                {" "}• ตัดบิลอัตโนมัติ {rolloverResult.billsPaid} รายการ ({formatTHB(rolloverResult.billsTotal)})
                {rolloverResult.billsSkipped > 0
                  ? ` • ข้าม ${rolloverResult.billsSkipped} รายการ (ยอดเงินไม่พอ)`
                  : ""}
                {" "}• รีเซ็ตโควต้าทุกหมวดหมู่เป็น ฿0 แล้ว
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Section 4: AI Assistant Preferences */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-on-surface m-0">การตั้งค่าผู้ช่วย AI (OpenRouter)</h2>
        <div className="rounded-xl bg-surface-container border border-outline-variant/30 p-5 space-y-4">
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <div className="text-sm font-semibold text-on-surface">
                จัดหมวดหมู่ธุรกรรมอัตโนมัติด้วย AI
              </div>
              <div className="text-xs text-on-surface-variant">
                ให้ AI ช่วยเลือกหมวดหมู่ที่เหมาะสมจากชื่อร้านค้าหรือสลิป QR
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.aiAutoCategorize}
              onChange={(e) => updateSettings({ aiAutoCategorize: e.target.checked })}
              className="w-4 h-4 accent-primary"
            />
          </label>

          <div className="pt-3 border-t border-outline-variant/20">
            <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
              OpenRouter API Key (ไม่บังคับ — ใช้แทน OPENROUTER_API_KEY ของเซิร์ฟเวอร์)
            </label>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="sk-or-v1-..."
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2 text-sm font-mono text-on-surface"
            />
          </div>
        </div>
      </section>

      {/* Logout */}
      <div className="pt-4 border-t border-outline-variant/30 flex justify-end">
        <button
          type="button"
          onClick={() => {
            logoutUser();
            router.push("/login");
          }}
          className="px-4 py-2 rounded-lg border border-error/40 text-error text-sm font-semibold hover:bg-error-container/20"
        >
          ออกจากระบบ (Logout)
        </button>
      </div>
    </form>
  );
}
