"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  filterTransactionsByRange,
  resolveDateRange,
} from "@/components/dashboard/dashboard-utils";
import { IconColorPicker } from "@/components/IconColorPicker";
import { useFinora } from "@/context/FinoraContext";
import { formatTHB, isBaseCategory, isInCurrentQuotaCycle, nextCategoryColor } from "@/lib/seed";
import type { Category } from "@/lib/types";

function CategoryBudgetInput({
  categoryId,
  categoryName,
  budget,
  onCommit,
}: {
  categoryId: string;
  categoryName: string;
  budget: number;
  onCommit: (nextBudget: number) => void;
}) {
  const [draft, setDraft] = useState(String(budget));

  useEffect(() => {
    setDraft(String(budget));
  }, [budget]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === "") {
      onCommit(0);
      setDraft("0");
      return;
    }
    const parsed = Math.max(0, Number(trimmed));
    if (Number.isFinite(parsed)) {
      onCommit(parsed);
      setDraft(String(parsed));
    } else {
      setDraft(String(budget));
    }
  };

  return (
    <input
      id={`cat-budget-${categoryId}`}
      type="number"
      min="0"
      aria-label={`งบประมาณหมวด ${categoryName}`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setDraft(String(budget));
          e.currentTarget.blur();
        }
      }}
      className="w-28 bg-surface-container-low border border-outline-variant/40 rounded-lg px-2.5 py-1.5 text-sm font-mono text-right text-on-surface focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
    />
  );
}

export default function CategoriesPage() {
  const {
    categories,
    transactions,
    recurring,
    settings,
    addCategory,
    deleteCategory,
    updateCategoryBudget,
  } = useFinora();
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("5000");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [icon, setIcon] = useState("label");
  const [customColor, setCustomColor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const newColor = customColor ?? nextCategoryColor(categories.map((c) => c.color));
  const isIncomeTab = type === "income";
  const expenseCats = categories.filter((c) => c.type === "expense" && c.id !== "recurring");
  const incomeCats = categories.filter((c) => c.type === "income" && c.id !== "recurring");
  const visibleCats = isIncomeTab ? incomeCats : expenseCats;

  const budgetVsIncome = useMemo(() => {
    const totalExpenseBudget = expenseCats.reduce((s, c) => s + Math.max(0, c.budget), 0);
    const thisMonthRange = resolveDateRange("this_month");
    const thisMonthIncome = filterTransactionsByRange(
      transactions,
      thisMonthRange.startYmd,
      thisMonthRange.endYmd
    )
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + t.amount, 0);
    const activeRecurringIncome = recurring
      .filter((r) => r.active && r.type === "income")
      .reduce((s, r) => s + (r.cycle === "yearly" ? r.amount / 12 : r.amount), 0);
    const referenceIncome = Math.max(thisMonthIncome, activeRecurringIncome);
    const surplus = referenceIncome - totalExpenseBudget;
    return { totalExpenseBudget, referenceIncome, surplus };
  }, [expenseCats, transactions, recurring]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addCategory({
      name: name.trim(),
      icon,
      color: newColor,
      budget: isIncomeTab ? 0 : Math.max(0, Number(budget) || 0),
      type,
    });
    setName("");
    setCustomColor(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface tracking-tight m-0">
          จัดการหมวดหมู่และงบประมาณ
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          {isIncomeTab
            ? "จัดการหมวดหมู่แหล่งรายรับและติดตามยอดรายรับรวมในแต่ละหมวด"
            : "กำหนดเพดานงบประมาณรายเดือนสำหรับแต่ละหมวดหมู่เพื่อควบคุมรายจ่ายอย่างมีประสิทธิภาพ"}
        </p>
      </div>

      {/* Mode Tabs */}
      <div className="inline-flex self-start p-1 rounded-xl bg-surface-container border border-outline-variant/30 gap-1">
        <button
          type="button"
          onClick={() => setType("expense")}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            !isIncomeTab
              ? "bg-secondary text-on-secondary shadow-sm"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          หมวดรายจ่าย ({expenseCats.length})
        </button>
        <button
          type="button"
          onClick={() => setType("income")}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            isIncomeTab
              ? "bg-primary-container text-on-primary-container shadow-sm"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          หมวดรายรับ ({incomeCats.length})
        </button>
      </div>

      {/* Add Category Form */}
      <form
        onSubmit={handleAdd}
        className={`rounded-xl bg-surface-container border border-outline-variant/30 p-5 grid grid-cols-1 gap-3 items-end ${
          isIncomeTab ? "md:grid-cols-3" : "md:grid-cols-4"
        }`}
      >
        <div>
          <label
            htmlFor="cat-name-input"
            className="block text-xs font-semibold text-on-surface-variant mb-1"
          >
            {isIncomeTab ? "ชื่อหมวดรายรับใหม่" : "ชื่อหมวดรายจ่ายใหม่"}
          </label>
          <input
            id="cat-name-input"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isIncomeTab ? "เช่น งานฟรีแลนซ์, ค่าเช่า" : "เช่น สุขภาพ & ฟิตเนส"}
            className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
          />
        </div>
        <IconColorPicker
          id="cat-icon-label"
          label="ไอคอน & สี"
          colorSectionLabel="สีหมวดหมู่"
          dialogLabel="เลือกสีและไอคอนหมวดหมู่"
          icon={icon}
          color={newColor}
          onIconChange={setIcon}
          onColorChange={setCustomColor}
        />
        {!isIncomeTab && (
          <div>
            <label
              htmlFor="cat-budget-input"
              className="block text-xs font-semibold text-on-surface-variant mb-1"
            >
              งบประมาณต่อเดือน (THB)
            </label>
            <input
              id="cat-budget-input"
              type="number"
              min="0"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm font-mono text-on-surface focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
            />
          </div>
        )}
        <button
          type="submit"
          className="py-2 px-4 rounded-lg bg-primary-container text-on-primary-container text-sm font-semibold hover:opacity-90"
        >
          {isIncomeTab ? "+ เพิ่มหมวดรายรับ" : "+ เพิ่มหมวดรายจ่าย"}
        </button>
      </form>

      {/* Budget vs Reference Income Summary Bar */}
      {!isIncomeTab && (
        <div className="rounded-xl bg-surface-container border border-outline-variant/30 p-4 sm:p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                เพดานงบรายจ่ายรวม ({expenseCats.length} หมวด)
              </span>
              <span className="text-lg font-bold font-mono text-on-surface">
                {formatTHB(budgetVsIncome.totalExpenseBudget)}
              </span>
            </div>
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                ฐานรายรับอ้างอิง/เดือน
              </span>
              <span className="text-lg font-bold font-mono text-on-surface">
                {formatTHB(budgetVsIncome.referenceIncome)}
              </span>
            </div>
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                {budgetVsIncome.surplus >= 0 ? "คงเหลือเผื่อออม / สำรอง" : "ตั้งงบเกินรายรับอ้างอิง"}
              </span>
              <span
                className={`text-lg font-bold font-mono ${
                  budgetVsIncome.surplus >= 0 ? "text-primary" : "text-amber-700 dark:text-amber-300"
                }`}
              >
                {budgetVsIncome.surplus >= 0
                  ? `+${formatTHB(budgetVsIncome.surplus)}`
                  : formatTHB(budgetVsIncome.surplus)}
              </span>
            </div>
          </div>

          {budgetVsIncome.totalExpenseBudget > budgetVsIncome.referenceIncome && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg border border-amber-300/80 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-900 dark:text-amber-200"
            >
              <span className="material-symbols-outlined text-[17px] text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                warning
              </span>
              <span>
                {budgetVsIncome.referenceIncome > 0
                  ? `เพดานงบรายจ่ายรวมสูงกว่ารายรับอ้างอิงอยู่ ${formatTHB(
                      budgetVsIncome.totalExpenseBudget - budgetVsIncome.referenceIncome
                    )} แนะนำปรับลดงบบางหมวดเพื่อให้สมดุลกับรายรับ`
                  : "ยังไม่มีข้อมูลรายรับเดือนนี้หรือรายรับประจำในระบบ จึงยังไม่สามารถเทียบเพดานงบกับรายรับจริงได้"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Category List (Flattened with dividers) */}
      <div className="rounded-2xl bg-surface-container border border-outline-variant/30 divide-y divide-outline-variant/20">
        {visibleCats.map((cat) => {
          const spent = transactions
            .filter(
              (t) =>
                t.categoryId === cat.id &&
                isInCurrentQuotaCycle(t.date, settings.quotaResetAt)
            )
            .reduce((s, t) => s + t.amount, 0);
          const rawPct = cat.budget > 0 ? Math.round((spent / cat.budget) * 100) : 0;
          const barWidth = Math.min(100, rawPct);
          const over = cat.budget > 0 && spent > cat.budget;

          const base = isBaseCategory(cat.id);

          return (
            <div key={cat.id} className="p-5 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${cat.color}1F`, color: cat.color }}
                  >
                    <span className="material-symbols-outlined">{cat.icon}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-on-surface m-0">{cat.name}</h3>
                      {base && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                          พื้นฐาน
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-on-surface-variant">
                      {cat.type === "income" ? "หมวดรายรับ" : "หมวดรายจ่าย"} • ยอดรวมปัจจุบัน{" "}
                      <strong className="font-mono text-on-surface">{formatTHB(spent)}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {cat.type === "expense" &&
                    (cat.id === "recurring" ? (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface-variant">
                        <span className="material-symbols-outlined text-[15px] text-primary">lock</span>
                        <span className="font-mono font-semibold text-on-surface">
                          {formatTHB(cat.budget)}
                        </span>
                        <span>(คำนวณจาก Recurring)</span>
                      </div>
                    ) : (
                      <>
                        <label
                          htmlFor={`cat-budget-${cat.id}`}
                          className="text-xs text-on-surface-variant"
                        >
                          งบประมาณ:
                        </label>
                        <CategoryBudgetInput
                          categoryId={cat.id}
                          categoryName={cat.name}
                          budget={cat.budget}
                          onCommit={(next) => updateCategoryBudget(cat.id, next)}
                        />
                      </>
                    ))}
                  {!base && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(cat)}
                      aria-label={`ลบหมวดหมู่ ${cat.name}`}
                      title="ลบหมวดหมู่"
                      className="p-2 rounded-lg text-outline hover:text-error hover:bg-error/10 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  )}
                </div>
              </div>

              {cat.type === "expense" && cat.budget > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className={over ? "text-error font-semibold" : "text-on-surface-variant"}>
                      {over ? `เกินงบแล้ว (${rawPct}%)` : `ใช้ไปแล้ว ${rawPct}%`}
                    </span>
                    <span className="font-mono text-on-surface-variant">
                      {formatTHB(spent)} / {formatTHB(cat.budget)}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface-container-highest overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${over ? "bg-error" : ""}`}
                      style={{ width: `${barWidth}%`, backgroundColor: over ? undefined : cat.color }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="ต้องการลบหมวดหมู่นี้ใช่ไหม?"
        description={
          deleteTarget
            ? `หมวดหมู่ "${deleteTarget.name}" จะถูกลบออก โดยธุรกรรมเดิมในหมวดนี้จะถูกย้ายไปยังหมวดหมู่พื้นฐาน ("${
                deleteTarget.type === "income" ? "เงินเดือน & โบนัส" : "อาหาร & เครื่องดื่ม"
              }")`
            : ""
        }
        confirmLabel="ยืนยันลบหมวดหมู่"
        icon="delete"
        onConfirm={() => {
          if (deleteTarget) {
            deleteCategory(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
