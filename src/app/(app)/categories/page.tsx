"use client";

import React, { useState } from "react";
import { IconColorPicker } from "@/components/IconColorPicker";
import { useFinora } from "@/context/FinoraContext";
import { formatTHB, isBaseCategory, nextCategoryColor } from "@/lib/seed";

export default function CategoriesPage() {
  const { categories, transactions, addCategory, deleteCategory, updateCategoryBudget } = useFinora();
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("5000");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [icon, setIcon] = useState("label");
  const [customColor, setCustomColor] = useState<string | null>(null);

  const newColor = customColor ?? nextCategoryColor(categories.map((c) => c.color));

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
    setCustomColor(null);
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
        <IconColorPicker
          id="cat-icon-label"
          label="ไอคอน"
          colorSectionLabel="สีหมวดหมู่"
          dialogLabel="เลือกสีและไอคอนหมวดหมู่"
          icon={icon}
          color={newColor}
          onIconChange={setIcon}
          onColorChange={setCustomColor}
        />
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
