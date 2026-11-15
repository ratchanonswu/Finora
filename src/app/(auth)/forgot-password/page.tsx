"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";

const HIGHLIGHTS = [
  {
    icon: "timer",
    title: "ลิงก์มีอายุ 15 นาที",
    desc: "เพื่อป้องกันการสวมรอย ลิงก์จะหมดอายุทันทีหลังครบกำหนดเวลา",
  },
  {
    icon: "mark_email_unread",
    title: "ตรวจสอบกล่องจดหมายเข้า",
    desc: "หากไม่พบอีเมลภายใน 2 นาที โปรดตรวจสอบในโฟลเดอร์ Junk/Spam",
  },
  {
    icon: "support_agent",
    title: "ต้องการความช่วยเหลือเพิ่มเติม?",
    desc: "ติดต่อฝ่ายสนับสนุนได้ตลอด 24 ชั่วโมงที่ support@finora.io",
  },
];

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("กรุณากรอกอีเมลของคุณ");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("รูปแบบอีเมลไม่ถูกต้อง");
      return;
    }
    setError("");
    setSent(true);
  };

  return (
    <AuthShell
      showcaseTitle="การกู้คืนบัญชีอย่างปลอดภัย"
      showcaseSubtitle="เราปกป้องข้อมูลทางการเงินของคุณด้วยมาตรฐานความปลอดภัยระดับ FinTech ลิงก์รีเซ็ตรหัสผ่านจะถูกเข้ารหัสแบบใช้ครั้งเดียว"
      highlights={HIGHLIGHTS}
      footerBadge="End-to-End Encryption"
    >
      {!sent ? (
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-on-surface tracking-tight mb-1.5">
              ลืมรหัสผ่าน?
            </h1>
            <p className="text-sm text-on-surface-variant">
              กรอกอีเมลที่ใช้สมัครบัญชี Finora เพื่อรับลิงก์สำหรับตั้งรหัสผ่านใหม่
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-lg border border-error/40 bg-error-container/20 text-on-error-container text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-error shrink-0">
                error
              </span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="reset-email"
                className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5"
              >
                อีเมล (Registered Email)
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                  mail
                </span>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@finora.io"
                  className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg pl-10 pr-4 py-2.5 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-2.5 px-4 rounded-lg bg-primary-container text-on-primary-container font-semibold text-sm hover:opacity-90 flex items-center justify-center gap-2 shadow-sm"
            >
              <span>ส่งลิงก์รีเซ็ตรหัสผ่าน</span>
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-outline-variant/20 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>กลับสู่หน้าเข้าสู่ระบบ (Back to Sign In)</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary-container/20 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[32px]">mark_email_read</span>
          </div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight mb-2">
            ส่งลิงก์สำเร็จแล้ว
          </h1>
          <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
            เราได้ส่งคำแนะนำในการตั้งรหัสผ่านใหม่ไปยังอีเมล
            <br />
            <strong className="text-on-surface font-mono">{email}</strong>
            <br />
            โปรดตรวจสอบกล่องข้อความของคุณและคลิกลิงก์ภายใน 15 นาที
          </p>
          <div className="space-y-3">
            <Link
              href="/login"
              className="block w-full py-2.5 px-4 rounded-lg bg-primary-container text-on-primary-container font-semibold text-sm hover:opacity-90 shadow-sm"
            >
              กลับสู่หน้าเข้าสู่ระบบ (Sign In)
            </Link>
            <button
              type="button"
              disabled={cooldown > 0}
              onClick={() => setCooldown(30)}
              className="w-full py-2 px-4 rounded-lg border border-outline-variant/40 text-on-surface-variant hover:text-on-surface text-xs font-medium disabled:opacity-50"
            >
              {cooldown > 0
                ? `ส่งอีกครั้งได้ใน (${cooldown}s)`
                : "ยังไม่ได้รับอีเมล? ส่งใหม่อีกครั้ง"}
            </button>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
