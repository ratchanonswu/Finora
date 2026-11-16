"use client";

import React, { useState } from "react";
import { useFinora } from "@/context/FinoraContext";
import { formatTHB, isBaseCategory, nextCategoryColor } from "@/lib/seed";

const ICON_CHOICES = [
  { icon: "label", label: "ทั่วไป" },
  { icon: "fitness_center", label: "สุขภาพ & ฟิตเนส" },
  { icon: "school", label: "การศึกษา" },
  { icon: "pets", label: "สัตว์เลี้ยง" },
  { icon: "flight", label: "ท่องเที่ยว" },
  { icon: "medical_services", label: "ค่ารักษาพยาบาล" },
  { icon: "card_giftcard", label: "ของขวัญ" },
  { icon: "work", label: "งานเสริม / ฟรีแลนซ์" },
];

export default function CategoriesPage() {
  const { categories, transactions, addCategory, deleteCategory, updateCategoryBudget } = useFinora();
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("5000");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [icon, setIcon] = useState("label");
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  const newColor = nextCategoryColor(categories.map((c) => c.color));
  const currentIconLabel = ICON_CHOICES.find((o) => o.icon === icon)?.label ?? icon;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addCategory({
      name: name.trim(),
      icon,
      color: newColor,
      budget: Number(budget) || 0,
      type,
    });
    setName("");
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface tracking-tight m-0">
          จัดการหมวดหมู่และงบประมาณ
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          กำหนดเพดานงบประมาณรายเดือนสำหรับแต่ละหมวดหมู่เพื่อควบคุมรายจ่ายอย่างมีประสิทธิภาพ
        </p>
      </div>

      {/* Add Category Form */}
      <form
        onSubmit={handleAdd}
        className="rounded-xl bg-surface-container border border-outline-variant/30 p-5 grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
      >
        <div>
          <label className="block text-xs font-semibold text-on-surface-variant mb-1">
            ชื่อหมวดหมู่ใหม่
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น สุขภาพ & ฟิตเนส"
            className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm text-on-surface"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-on-surface-variant mb-1">
            ประเภท
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "expense" | "income")}
            className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm text-on-surface"
          >
            <option value="expense">รายจ่าย (Expense)</option>
            <option value="income">รายรับ (Income)</option>
          </select>
        </div>
        <div className="relative">
          <span id="cat-icon-label" className="block text-xs font-semibold text-on-surface-variant mb-1">
            ไอคอน
          </span>
          <button
            type="button"
            aria-labelledby="cat-icon-label"
            aria-haspopup="dialog"
            aria-expanded={iconPickerOpen}
            onClick={() => setIconPickerOpen((o) => !o)}
            className="w-full flex items-center gap-2.5 bg-surface-container-low border border-outline-variant/40 rounded-lg pl-1.5 pr-3 py-1 text-sm text-on-surface hover:border-primary/60 focus:outline-none focus:border-primary"
          >
            <span
              className="w-7 h-7 shrink-0 rounded-md flex items-center justify-center"
              style={{ backgroundColor: `${newColor}1F`, color: newColor }}
            >
              <span className="material-symbols-outlined text-[18px] leading-none">{icon}</span>
            </span>
            <span className="flex-1 text-left truncate">{currentIconLabel}</span>
            <span className="material-symbols-outlined text-[18px] text-outline">expand_more</span>
          </button>

          {iconPickerOpen && (
            <>
              {/* Click-away layer */}
              <div className="fixed inset-0 z-40" onClick={() => setIconPickerOpen(false)} />
              <div
                role="dialog"
                aria-label="เลือกไอคอนหมวดหมู่"
                onKeyDown={(e) => e.key === "Escape" && setIconPickerOpen(false)}
                className="absolute z-50 left-0 top-full mt-2 w-72 rounded-xl bg-surface-container border border-outline-variant/40 shadow-xl p-3"
              >
                <div className="grid grid-cols-4 gap-2">
                  {ICON_CHOICES.map((o, i) => {
                    const selected = o.icon === icon;
                    return (
                      <button
                        key={o.icon}
                        type="button"
                        autoFocus={selected || (i === 0 && !ICON_CHOICES.some((c) => c.icon === icon))}
                        title={o.label}
                        aria-label={o.label}
                        aria-pressed={selected}
                        onClick={() => {
                          setIcon(o.icon);
                          setIconPickerOpen(false);
                        }}
                        className={`aspect-square rounded-lg flex items-center justify-center border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          selected
                            ? "border-transparent"
                            : "border-outline-variant/30 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                        }`}
                        style={selected ? { backgroundColor: `${newColor}1F`, color: newColor } : undefined}
                      >
                        <span className="material-symbols-outlined text-[22px] leading-none">{o.icon}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 pt-2.5 border-t border-outline-variant/20 text-xs text-on-surface-variant">
                  {currentIconLabel}
                </p>
              </div>
            </>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-on-surface-variant mb-1">
            งบประมาณต่อเดือน (THB)
          </label>
          <input
            type="number"
            min="0"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm font-mono text-on-surface"
          />
        </div>
        <button
          type="submit"
          className="py-2 px-4 rounded-lg bg-primary-container text-on-primary-container text-sm font-semibold hover:opacity-90"
        >
          + เพิ่มหมวดหมู่
        </button>
      </form>

      {/* Category List (Flattened with dividers) */}
      <div className="rounded-2xl bg-surface-container border border-outline-variant/30 divide-y divide-outline-variant/20">
        {categories.map((cat) => {
          const spent = transactions
            .filter((t) => t.categoryId === cat.id)
            .reduce((s, t) => s + t.amount, 0);
          const pct = cat.budget > 0 ? Math.min(100, Math.round((spent / cat.budget) * 100)) : 0;
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
                  {cat.type === "expense" && (
                    <>
                      <label className="text-xs text-on-surface-variant">งบประมาณ:</label>
                      <input
                        type="number"
                        min="0"
                        value={cat.budget}
                        onChange={(e) => updateCategoryBudget(cat.id, Number(e.target.value) || 0)}
                        className="w-28 bg-surface-container-low border border-outline-variant/40 rounded-lg px-2.5 py-1.5 text-sm font-mono text-right text-on-surface"
                      />
                    </>
                  )}
                  {!base && (
                    <button
                      type="button"
                      onClick={() => deleteCategory(cat.id)}
                      aria-label={`ลบหมวดหมู่ ${cat.name}`}
                      title="ลบหมวดหมู่"
                      className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-surface-container-high transition-colors"
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
                      ใช้ไปแล้ว {pct}%
                    </span>
                    <span className="font-mono text-on-surface-variant">
                      {formatTHB(spent)} / {formatTHB(cat.budget)}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface-container-highest overflow-hidden">
                    <div
                      className={`h-full rounded-full ${over ? "bg-error" : ""}`}
                      style={{ width: `${pct}%`, backgroundColor: over ? undefined : cat.color }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
