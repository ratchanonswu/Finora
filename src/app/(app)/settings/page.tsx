"use client";

import React, { useState } from "react";
import { useFinora, type MonthlyRolloverResult } from "@/context/FinoraContext";
import { formatTHB } from "@/lib/seed";

function addDaysIso(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate()
  ).padStart(2, "0")}`;
}

function endOfMonthIso(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const lastDay = new Date(y, m, 0).getDate();
  if (d >= lastDay) {
    const nextMonthLast = new Date(y, m + 1, 0);
    return `${nextMonthLast.getFullYear()}-${String(nextMonthLast.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(nextMonthLast.getDate()).padStart(2, "0")}`;
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

export default function SettingsPage() {
  const {
    theme,
    toggleTheme,
    user,
    updateUser,
    settings,
    updateSettings,
    recurring,
    bankBalance,
    logoutUser,
    runMonthlyRollover,
  } = useFinora();

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [geminiKey, setGeminiKey] = useState(settings.geminiApiKeyOverride);
  const [savedNotice, setSavedNotice] = useState(false);
  const [rolloverResult, setRolloverResult] = useState<MonthlyRolloverResult | null>(null);
  const [simulateDate, setSimulateDate] = useState(() => {
    const nextDue = recurring
      .filter((r) => r.active && /^\d{4}-\d{2}-\d{2}$/.test(r.nextDueDate))
      .map((r) => r.nextDueDate)
      .sort()[0];
    return nextDue || new Date().toISOString().slice(0, 10);
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser({ name: name.trim() || user.name, email: email.trim() || user.email });
    updateSettings({ geminiApiKeyOverride: geminiKey.trim() });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleTestRollover = () => {
    const res = runMonthlyRollover(simulateDate);
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

          <div className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <label
                  htmlFor="monthly-salary-input"
                  className="text-sm font-semibold text-on-surface block"
                >
                  เงินเดือนประจำ (THB)
                </label>
                <div className="text-xs text-on-surface-variant">
                  เติมเข้า Finora Virtual Wallet อัตโนมัติเมื่อถึงวันที่กำหนดของเดือน
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-outline-variant/20">
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="salary-payday-input"
                  className="text-xs font-medium text-on-surface-variant"
                >
                  วันที่เงินเดือนเข้า (1–31)
                </label>
                <input
                  id="salary-payday-input"
                  type="number"
                  min="1"
                  max="31"
                  value={settings.salaryPayday ?? 25}
                  onChange={(e) =>
                    updateSettings({
                      salaryPayday: Math.max(1, Math.min(31, Number(e.target.value) || 1)),
                    })
                  }
                  className="w-20 bg-surface-container-low border border-outline-variant/40 rounded-lg px-2.5 py-1.5 text-xs font-mono text-right text-on-surface"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="quota-reset-day-input"
                  className="text-xs font-medium text-on-surface-variant"
                >
                  วันที่รีเซ็ตโควต้าหมวดหมู่ (1–31)
                </label>
                <input
                  id="quota-reset-day-input"
                  type="number"
                  min="1"
                  max="31"
                  value={settings.quotaResetDay ?? 1}
                  onChange={(e) =>
                    updateSettings({
                      quotaResetDay: Math.max(1, Math.min(31, Number(e.target.value) || 1)),
                    })
                  }
                  className="w-20 bg-surface-container-low border border-outline-variant/40 rounded-lg px-2.5 py-1.5 text-xs font-mono text-right text-on-surface"
                />
              </div>
            </div>
          </div>

          <div className="p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-on-surface">
                  จำลองวันครบรอบเดือน (Simulate Rollover Date)
                </div>
                <div className="text-xs text-on-surface-variant">
                  เลือกวันที่ต้องการจำลอง ระบบจะรันเงินเดือน บิล Recurring และรีเซ็ตโควต้าที่ถึงกำหนดเรียงตามวันที่จริง
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <input
                  type="date"
                  aria-label="วันที่จำลอง"
                  value={simulateDate}
                  onChange={(e) => setSimulateDate(e.target.value)}
                  className="bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-1.5 text-xs font-mono text-on-surface"
                />
                <button
                  type="button"
                  onClick={() => setSimulateDate((d) => addDaysIso(d, 1))}
                  className="px-2.5 py-1.5 rounded-lg border border-outline-variant/40 text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                >
                  +1 วัน
                </button>
                <button
                  type="button"
                  onClick={() => setSimulateDate((d) => addDaysIso(d, 7))}
                  className="px-2.5 py-1.5 rounded-lg border border-outline-variant/40 text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                >
                  +7 วัน
                </button>
                <button
                  type="button"
                  onClick={() => setSimulateDate((d) => endOfMonthIso(d))}
                  className="px-2.5 py-1.5 rounded-lg border border-outline-variant/40 text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                >
                  สิ้นเดือน
                </button>
                <button
                  type="button"
                  onClick={handleTestRollover}
                  className="px-4 py-2 rounded-lg bg-primary-container text-on-primary-container text-xs font-semibold hover:opacity-90"
                >
                  รันจำลองถึงวันที่นี้
                </button>
              </div>
            </div>
            {rolloverResult && (
              <div
                role="status"
                className="text-xs text-primary bg-primary-container/15 border border-primary/30 rounded-lg px-3.5 py-2.5 font-medium animate-page-in"
              >
                จำลองถึงวันที่ {rolloverResult.simulatedDate}:
                {rolloverResult.salaryCredited > 0
                  ? ` เติมเงินเดือน ${rolloverResult.salaryCount} รอบ (+${formatTHB(
                      rolloverResult.salaryCredited
                    )}) •`
                  : " ยังไม่ถึงวันเงินเดือนเข้า (หรือเติมในรอบเดือนนี้แล้ว) •"}
                {rolloverResult.recurringIncomeCount > 0
                  ? ` รับรายรับประจำ ${rolloverResult.recurringIncomeCount} รายการ (+${formatTHB(
                      rolloverResult.recurringIncomeTotal
                    )}) •`
                  : ""}
                {" "}ตัดบิลอัตโนมัติ {rolloverResult.billsPaid} รายการ ({formatTHB(rolloverResult.billsTotal)})
                {rolloverResult.billsSkipped > 0
                  ? ` • ข้าม ${rolloverResult.billsSkipped} รายการ (ยอดเงินไม่พอ)`
                  : ""}
                {rolloverResult.quotaResetCount > 0
                  ? ` • รีเซ็ตโควต้าหมวดหมู่ ${rolloverResult.quotaResetCount} รอบแล้ว`
                  : ""}
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
          }}
          className="px-4 py-2 rounded-lg border border-error/40 text-error text-sm font-semibold hover:bg-error-container/20"
        >
          ออกจากระบบ (Logout)
        </button>
      </div>
    </form>
  );
}
