"use client";

import React, { useMemo, useState } from "react";
import { COLOR_CHOICES, IconColorPicker } from "@/components/IconColorPicker";
import { useFinora } from "@/context/FinoraContext";
import { formatTHB } from "@/lib/seed";

export default function RecurringPage() {
  const {
    recurring,
    categories,
    toggleRecurring,
    addRecurring,
    deleteRecurring,
    updateRecurringDate,
  } = useFinora();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("entertainment");
  const [cycle, setCycle] = useState<"monthly" | "weekly" | "yearly">("monthly");
  const [nextDueDate, setNextDueDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [icon, setIcon] = useState("autorenew");
  const [color, setColor] = useState(COLOR_CHOICES[0]);
  const [showForm, setShowForm] = useState(false);

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === "expense"),
    [categories]
  );

  const monthlyTotal = useMemo(
    () =>
      recurring
        .filter((r) => r.active)
        .reduce((sum, r) => sum + (r.cycle === "yearly" ? r.amount / 12 : r.amount), 0),
    [recurring]
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amount);
    if (!title.trim() || !Number.isFinite(num) || num <= 0 || !nextDueDate) return;
    addRecurring({
      title: title.trim(),
      amount: num,
      categoryId,
      cycle,
      nextDueDate,
      active: true,
      icon,
      color,
    });
    setTitle("");
    setAmount("");
    setIcon("autorenew");
    setColor(COLOR_CHOICES[0]);
    setShowForm(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight m-0">
            รายการตัดเงินอัตโนมัติ (Recurring)
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            ยอดภาระผูกพันรายเดือนที่เปิดใช้งาน:{" "}
            <strong className="text-on-surface font-mono">{formatTHB(monthlyTotal)}</strong>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary-container text-on-primary-container text-sm font-semibold hover:opacity-90 shadow-sm self-start"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>เพิ่มรายการอัตโนมัติ</span>
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl bg-surface-container border border-outline-variant/30 p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end"
        >
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              ชื่อค่าบริการ / บิล
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น YouTube Premium, ค่าฟิตเนส"
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm text-on-surface"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              จำนวนเงิน (THB)
            </label>
            <input
              type="number"
              required
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="299"
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm font-mono text-on-surface"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              หมวดหมู่
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm text-on-surface"
            >
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              รอบตัดเงิน
            </label>
            <select
              value={cycle}
              onChange={(e) => setCycle(e.target.value as "monthly" | "weekly" | "yearly")}
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm text-on-surface"
            >
              <option value="monthly">รายเดือน</option>
              <option value="weekly">รายสัปดาห์</option>
              <option value="yearly">รายปี</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              วันตัดเงินถัดไป
            </label>
            <input
              type="date"
              required
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm font-mono text-on-surface"
            />
          </div>
          <IconColorPicker
            id="rec-icon-label"
            label="ไอคอน & สี"
            colorSectionLabel="สีรายการ"
            dialogLabel="เลือกสีและไอคอนรายการอัตโนมัติ"
            icon={icon}
            color={color}
            onIconChange={setIcon}
            onColorChange={setColor}
          />
          <button
            type="submit"
            className="py-2 px-4 rounded-lg bg-primary-container text-on-primary-container text-sm font-semibold hover:opacity-90"
          >
            บันทึก
          </button>
        </form>
      )}

      <div className="rounded-2xl bg-surface-container border border-outline-variant/30 divide-y divide-outline-variant/20">
        {recurring.length === 0 ? (
          <div className="p-8 text-center text-sm text-on-surface-variant">
            ยังไม่มีรายการจ่ายเงินอัตโนมัติ กด &ldquo;เพิ่มรายการอัตโนมัติ&rdquo; เพื่อเริ่มต้น
          </div>
        ) : (
          recurring.map((item) => {
            const cat = categories.find((c) => c.id === item.categoryId);
            const accent = item.color || cat?.color;
            return (
              <div
                key={item.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      accent ? "" : "bg-surface-container-high text-primary"
                    }`}
                    style={
                      accent
                        ? { backgroundColor: `${accent}1F`, color: accent }
                        : undefined
                    }
                  >
                    <span className="material-symbols-outlined">{item.icon}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-on-surface m-0">{item.title}</h3>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          item.active
                            ? "bg-primary-container/20 text-primary"
                            : "bg-surface-container-highest text-on-surface-variant"
                        }`}
                      >
                        {item.active ? "เปิดใช้งาน" : "หยุดชั่วคราว"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-on-surface-variant mt-1">
                      <span>{cat?.name || "ทั่วไป"}</span>
                      <span>•</span>
                      <label className="inline-flex items-center gap-1.5">
                        <span>รอบถัดไป:</span>
                        <input
                          type="date"
                          aria-label={`วันตัดเงินของ ${item.title}`}
                          value={item.nextDueDate}
                          onChange={(e) => {
                            if (e.target.value) {
                              updateRecurringDate(item.id, e.target.value);
                            }
                          }}
                          className="bg-surface-container-low border border-outline-variant/40 rounded-md px-2 py-0.5 font-mono text-xs text-on-surface focus:outline-none focus:border-primary"
                        />
                      </label>
                      <span>({item.cycle})</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <span className="text-lg font-bold font-mono text-on-surface">
                    {formatTHB(item.amount)}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleRecurring(item.id)}
                      className="px-3.5 py-1.5 rounded-lg border border-outline-variant/40 text-xs font-semibold text-on-surface hover:bg-surface-container-high"
                    >
                      {item.active ? "พักรายการ" : "เปิดใช้งาน"}
                    </button>
                    <button
                      type="button"
                      aria-label={`ลบรายการ ${item.title}`}
                      title="ลบรายการ"
                      onClick={() => deleteRecurring(item.id)}
                      className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error/10 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px] leading-none">
                        delete
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
