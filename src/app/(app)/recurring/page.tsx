"use client";

import React, { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { COLOR_CHOICES, IconColorPicker } from "@/components/IconColorPicker";
import { useFinora } from "@/context/FinoraContext";
import { toMonthlyRecurringAmount } from "@/lib/financial-insights";
import { formatTHB } from "@/lib/seed";
import type { RecurringPayment } from "@/lib/types";

export default function RecurringPage() {
  const {
    recurring,
    categories,
    toggleRecurring,
    addRecurring,
    deleteRecurring,
    updateRecurringDate,
    payRecurringItem,
    payAllActiveRecurring,
  } = useFinora();
  const [tab, setTab] = useState<"expense" | "income">("expense");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [incomeCategoryId, setIncomeCategoryId] = useState("salary");
  const [cycle, setCycle] = useState<"monthly" | "weekly" | "yearly">("monthly");
  const [nextDueDate, setNextDueDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [icon, setIcon] = useState("autorenew");
  const [color, setColor] = useState(COLOR_CHOICES[0]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecurringPayment | null>(null);
  const [confirmPayAllOpen, setConfirmPayAllOpen] = useState(false);

  const isIncomeTab = tab === "income";

  const incomeCategories = useMemo(
    () => categories.filter((c) => c.type === "income"),
    [categories]
  );

  const expenseItems = useMemo(
    () => recurring.filter((r) => (r.type ?? "expense") === "expense"),
    [recurring]
  );
  const incomeItems = useMemo(
    () => recurring.filter((r) => r.type === "income"),
    [recurring]
  );
  const visibleItems = isIncomeTab ? incomeItems : expenseItems;

  const activeItems = useMemo(
    () => visibleItems.filter((r) => r.active),
    [visibleItems]
  );

  const activeSum = useMemo(
    () => activeItems.reduce((sum, r) => sum + r.amount, 0),
    [activeItems]
  );

  const monthlyTotal = useMemo(
    () => activeItems.reduce((sum, r) => sum + toMonthlyRecurringAmount(r), 0),
    [activeItems]
  );

  const switchTab = (next: "expense" | "income") => {
    setTab(next);
    setIcon(next === "income" ? "payments" : "autorenew");
    setColor(next === "income" ? "#059669" : COLOR_CHOICES[0]);
    setFeedback(null);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amount);
    if (!title.trim() || !Number.isFinite(num) || num <= 0 || !nextDueDate) return;
    addRecurring({
      title: title.trim(),
      amount: num,
      type: tab,
      categoryId: isIncomeTab ? incomeCategoryId : "recurring",
      cycle,
      nextDueDate,
      active: true,
      icon,
      color,
    });
    setTitle("");
    setAmount("");
    setIcon(isIncomeTab ? "payments" : "autorenew");
    setColor(isIncomeTab ? "#059669" : COLOR_CHOICES[0]);
    setShowForm(false);
  };

  const handlePayOne = async (id: string, itemTitle: string, itemAmount: number) => {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    const res = await payRecurringItem(id);
    setBusy(false);
    setFeedback(
      res.ok
        ? {
            ok: true,
            text: `${isIncomeTab ? "รับยอด" : "ตัดยอด"} "${itemTitle}" จำนวน ${formatTHB(itemAmount)} เรียบร้อยแล้ว`,
          }
        : {
            ok: false,
            text: res.error || (isIncomeTab ? "ไม่สามารถรับยอดรายการได้" : "ไม่สามารถตัดยอดรายการได้"),
          }
    );
  };

  const handlePayAll = async () => {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    const res = await payAllActiveRecurring(tab);
    setBusy(false);
    setConfirmPayAllOpen(false);
    setFeedback(
      res.ok
        ? {
            ok: true,
            text: `${isIncomeTab ? "รับยอดรวม" : "ตัดยอดรวม"} ${res.count} รายการ เป็นเงิน ${formatTHB(res.total || 0)} เรียบร้อยแล้ว`,
          }
        : {
            ok: false,
            text: res.error || (isIncomeTab ? "ไม่สามารถรับยอดทั้งหมดได้" : "ไม่สามารถตัดยอดทั้งหมดได้"),
          }
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight m-0">
            รายการอัตโนมัติประจำเดือน (Recurring)
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {isIncomeTab
              ? "ยอดรายรับประจำรายเดือนที่เปิดใช้งาน:"
              : "ยอดภาระผูกพันรายเดือนที่เปิดใช้งาน:"}{" "}
            <strong className="text-on-surface font-mono">{formatTHB(monthlyTotal)}</strong>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <button
            type="button"
            disabled={busy || activeItems.length === 0}
            onClick={() => setConfirmPayAllOpen(true)}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border text-sm font-semibold disabled:opacity-50 shadow-sm transition-colors ${
              isIncomeTab
                ? "border-primary/40 bg-primary-container/15 text-primary hover:bg-primary-container/25"
                : "border-secondary/40 bg-secondary/10 text-secondary hover:bg-secondary/20"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">payments</span>
            <span>
              {isIncomeTab ? "รับยอดทั้งหมด" : "ตัดยอดทั้งหมด"} ({formatTHB(activeSum)})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary-container text-on-primary-container text-sm font-semibold hover:opacity-90 shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>{isIncomeTab ? "เพิ่มรายรับประจำ" : "เพิ่มรายจ่ายประจำ"}</span>
          </button>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="inline-flex self-start p-1 rounded-xl bg-surface-container border border-outline-variant/30 gap-1">
        <button
          type="button"
          onClick={() => switchTab("expense")}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            !isIncomeTab
              ? "bg-secondary text-on-secondary shadow-sm"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          รายจ่ายประจำ ({expenseItems.length})
        </button>
        <button
          type="button"
          onClick={() => switchTab("income")}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            isIncomeTab
              ? "bg-primary-container text-on-primary-container shadow-sm"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          รายรับประจำ ({incomeItems.length})
        </button>
      </div>

      {feedback && (
        <div
          role={feedback.ok ? "status" : "alert"}
          className={`p-3.5 rounded-xl border text-sm flex items-center justify-between gap-3 animate-page-in ${
            feedback.ok
              ? "border-primary/40 bg-primary-container/20 text-on-surface"
              : "border-error/40 bg-error-container/20 text-on-error-container"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`material-symbols-outlined text-[18px] ${
                feedback.ok ? "text-primary" : "text-error"
              }`}
            >
              {feedback.ok ? "check_circle" : "error"}
            </span>
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="ปิดการแจ้งเตือน"
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl bg-surface-container border border-outline-variant/30 p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end animate-page-in"
        >
          <div className="lg:col-span-2">
            <label
              htmlFor="rec-title-input"
              className="block text-xs font-semibold text-on-surface-variant mb-1"
            >
              {isIncomeTab ? "ชื่อแหล่งรายได้" : "ชื่อค่าบริการ / บิล"}
            </label>
            <input
              id="rec-title-input"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                isIncomeTab
                  ? "เช่น เงินเดือนประจำ, ค่าเช่าคอนโด"
                  : "เช่น YouTube Premium, ค่าฟิตเนส"
              }
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
            />
          </div>
          <div>
            <label
              htmlFor="rec-amount-input"
              className="block text-xs font-semibold text-on-surface-variant mb-1"
            >
              จำนวนเงิน (THB)
            </label>
            <input
              id="rec-amount-input"
              type="number"
              required
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={isIncomeTab ? "55000" : "299"}
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm font-mono text-on-surface focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
            />
          </div>
          {isIncomeTab && (
            <div>
              <label
                htmlFor="rec-income-cat"
                className="block text-xs font-semibold text-on-surface-variant mb-1"
              >
                หมวดหมู่รายรับ
              </label>
              <select
                id="rec-income-cat"
                value={incomeCategoryId}
                onChange={(e) => setIncomeCategoryId(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
              >
                {incomeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label
              htmlFor="rec-cycle"
              className="block text-xs font-semibold text-on-surface-variant mb-1"
            >
              {isIncomeTab ? "รอบรับเงิน" : "รอบตัดเงิน"}
            </label>
            <select
              id="rec-cycle"
              value={cycle}
              onChange={(e) => setCycle(e.target.value as "monthly" | "weekly" | "yearly")}
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              <option value="monthly">รายเดือน</option>
              <option value="weekly">รายสัปดาห์</option>
              <option value="yearly">รายปี</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="rec-due-date"
              className="block text-xs font-semibold text-on-surface-variant mb-1"
            >
              {isIncomeTab ? "วันรับเงินถัดไป" : "วันตัดเงินถัดไป"}
            </label>
            <input
              id="rec-due-date"
              type="date"
              required
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm font-mono text-on-surface focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
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
        {visibleItems.length === 0 ? (
          <div className="p-8 text-center text-sm text-on-surface-variant">
            {isIncomeTab
              ? "ยังไม่มีรายรับประจำ กด \"เพิ่มรายรับประจำ\" เพื่อเริ่มต้น"
              : "ยังไม่มีรายจ่ายประจำ กด \"เพิ่มรายจ่ายประจำ\" เพื่อเริ่มต้น"}
          </div>
        ) : (
          visibleItems.map((item) => {
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
                  <span
                    className={`text-lg font-bold font-mono ${
                      isIncomeTab ? "text-primary" : "text-secondary"
                    }`}
                  >
                    {isIncomeTab ? `+${formatTHB(item.amount)}` : `-${formatTHB(item.amount)}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handlePayOne(item.id, item.title, item.amount)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors ${
                        isIncomeTab
                          ? "bg-primary-container/20 text-primary hover:bg-primary-container/30"
                          : "bg-secondary/15 text-secondary hover:bg-secondary/25"
                      }`}
                    >
                      {isIncomeTab ? "รับยอดรายการนี้" : "ตัดยอดรายการนี้"}
                    </button>
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
                      onClick={() => setDeleteTarget(item)}
                      className="p-2 rounded-lg text-outline hover:text-error hover:bg-error/10 transition-colors"
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

      <ConfirmDialog
        open={deleteTarget !== null}
        title="ต้องการลบรายการประจำนี้ใช่ไหม?"
        description={
          deleteTarget
            ? `รายการ "${deleteTarget.title}" (${formatTHB(deleteTarget.amount)}) จะถูกลบออกจากการตัด/รับเงินอัตโนมัติ (ประวัติธุรกรรมที่บันทึกไปแล้วจะยังคงอยู่)`
            : ""
        }
        confirmLabel="ยืนยันลบรายการ"
        icon="delete"
        onConfirm={() => {
          if (deleteTarget) {
            deleteRecurring(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={confirmPayAllOpen}
        title={isIncomeTab ? "ยืนยันรับยอดรายการประจำทั้งหมด" : "ยืนยันตัดยอดรายการประจำทั้งหมด"}
        description={`ระบบจะ${
          isIncomeTab ? "บันทึกรับยอด" : "ตัดยอดชำระ"
        }รายการที่เปิดใช้งานอยู่ทั้งหมด ${activeItems.length} รายการ รวมเป็นเงิน ${formatTHB(
          activeSum
        )}`}
        confirmLabel={isIncomeTab ? "ยืนยันรับยอดทั้งหมด" : "ยืนยันตัดยอดทั้งหมด"}
        variant={isIncomeTab ? "primary" : "danger"}
        icon="payments"
        loading={busy}
        onConfirm={handlePayAll}
        onCancel={() => setConfirmPayAllOpen(false)}
      />
    </div>
  );
}
