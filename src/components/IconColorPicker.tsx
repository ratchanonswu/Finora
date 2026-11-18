"use client";

import React, { useState } from "react";
import { CATEGORY_PALETTE } from "@/lib/seed";

export const COLOR_CHOICES = [
  "#EA580C",
  "#8B5CF6",
  "#0284C7",
  "#4F46E5",
  "#DB2777",
  "#059669",
  "#CA8A04",
  ...CATEGORY_PALETTE.slice(0, 5),
];

export const ICON_CHOICES = [
  { icon: "autorenew", label: "รายการอัตโนมัติ" },
  { icon: "label", label: "ทั่วไป" },
  { icon: "restaurant", label: "อาหาร" },
  { icon: "local_cafe", label: "กาแฟ & เครื่องดื่ม" },
  { icon: "shopping_bag", label: "ช้อปปิ้ง" },
  { icon: "shopping_cart", label: "ของใช้เข้าบ้าน" },
  { icon: "home", label: "ที่อยู่อาศัย" },
  { icon: "bolt", label: "ค่าน้ำ & ค่าไฟ" },
  { icon: "phone_iphone", label: "มือถือ & เน็ต" },
  { icon: "directions_car", label: "เดินทาง & รถยนต์" },
  { icon: "flight", label: "ท่องเที่ยว" },
  { icon: "fitness_center", label: "สุขภาพ & ฟิตเนส" },
  { icon: "medical_services", label: "ค่ารักษาพยาบาล" },
  { icon: "pets", label: "สัตว์เลี้ยง" },
  { icon: "school", label: "การศึกษา" },
  { icon: "subscriptions", label: "สตรีมมิ่ง & สมาชิก" },
  { icon: "sports_esports", label: "เกม & บันเทิง" },
  { icon: "card_giftcard", label: "ของขวัญ & ทำบุญ" },
  { icon: "savings", label: "เงินออม" },
  { icon: "work", label: "งานเสริม / ฟรีแลนซ์" },
  { icon: "payments", label: "เงินเดือน & โบนัส" },
];

interface IconColorPickerProps {
  id: string;
  label?: string;
  colorSectionLabel?: string;
  dialogLabel?: string;
  icon: string;
  color: string;
  onIconChange: (icon: string) => void;
  onColorChange: (color: string) => void;
}

/** Popover picker for choosing an icon and accent color. */
export function IconColorPicker({
  id,
  label = "ไอคอน & สี",
  colorSectionLabel = "เลือกสี",
  dialogLabel = "เลือกสีและไอคอน",
  icon,
  color,
  onIconChange,
  onColorChange,
}: IconColorPickerProps) {
  const [open, setOpen] = useState(false);
  const currentIconLabel =
    ICON_CHOICES.find((o) => o.icon === icon)?.label ?? icon;

  return (
    <div className="relative">
      <span
        id={id}
        className="block text-xs font-semibold text-on-surface-variant mb-1"
      >
        {label}
      </span>
      <button
        type="button"
        aria-labelledby={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 bg-surface-container-low border border-outline-variant/40 rounded-lg pl-1.5 pr-3 py-1 text-sm text-on-surface hover:border-primary/60 focus:outline-none focus:border-primary"
      >
        <span
          className="w-7 h-7 shrink-0 rounded-md flex items-center justify-center"
          style={{ backgroundColor: `${color}1F`, color }}
        >
          <span className="material-symbols-outlined text-[18px] leading-none">
            {icon}
          </span>
        </span>
        <span className="flex-1 text-left truncate">{currentIconLabel}</span>
        <span className="material-symbols-outlined text-[18px] text-outline">
          expand_more
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label={dialogLabel}
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            className="absolute z-50 left-0 top-full mt-2 w-80 rounded-xl bg-surface-container border border-outline-variant/40 shadow-xl p-3.5 space-y-3 origin-top-left animate-modal-in"
          >
            <div>
              <span className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                {colorSectionLabel}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {COLOR_CHOICES.map((hex) => {
                  const active = hex.toUpperCase() === color.toUpperCase();
                  return (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`เลือกสี ${hex}`}
                      aria-pressed={active}
                      onClick={() => onColorChange(hex)}
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        active
                          ? "scale-110 ring-2 ring-on-surface ring-offset-2 ring-offset-surface-container"
                          : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: hex }}
                    >
                      {active && (
                        <span className="material-symbols-outlined text-[14px] leading-none text-white">
                          check
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2.5 border-t border-outline-variant/20">
              <span className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                ไอคอน ({currentIconLabel})
              </span>
              <div className="grid grid-cols-5 gap-1.5">
                {ICON_CHOICES.map((o, i) => {
                  const selected = o.icon === icon;
                  return (
                    <button
                      key={o.icon}
                      type="button"
                      autoFocus={
                        selected ||
                        (i === 0 && !ICON_CHOICES.some((c) => c.icon === icon))
                      }
                      title={o.label}
                      aria-label={o.label}
                      aria-pressed={selected}
                      onClick={() => {
                        onIconChange(o.icon);
                        setOpen(false);
                      }}
                      className={`aspect-square rounded-lg flex items-center justify-center border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        selected
                          ? "border-transparent"
                          : "border-outline-variant/30 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                      }`}
                      style={
                        selected
                          ? { backgroundColor: `${color}1F`, color }
                          : undefined
                      }
                    >
                      <span className="material-symbols-outlined text-[20px] leading-none">
                        {o.icon}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
