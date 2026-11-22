"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { useFinora } from "@/context/FinoraContext";
import { INITIAL_USER } from "@/lib/seed";
import { useDialogAccessibility } from "@/lib/useDialogAccessibility";

const HIGHLIGHTS = [
  {
    icon: "account_balance_wallet",
    title: "Virtual Bank Simulator",
    desc: "จำลองการเติมเงิน โอน และจ่ายบิลแบบเรียลไทม์ผ่าน API",
  },
  {
    icon: "psychology",
    title: "Gemini Pro AI Analysis",
    desc: "ให้คำแนะนำการเงินส่วนบุคคล ตอบคำถาม และสรุปสถิติประจำวัน",
  },
  {
    icon: "shield",
    title: "ความเป็นส่วนตัวแบบ Sandbox",
    desc: "ไม่ต้องใช้เลขบัญชีหรือบัตรจริง ปลอดภัยสำหรับการเรียนรู้และนำเสนอ",
  },
];

export default function RegisterPage() {
  const { user, registerUser } = useFinora();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [terms, setTerms] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [error, setError] = useState("");
  const termsDialogRef = useRef<HTMLDivElement | null>(null);

  useDialogAccessibility(termsModalOpen, termsDialogRef, () => setTermsModalOpen(false), true);

  const strength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  }, [password]);

  const strengthMeta = [
    { width: "0%", label: "ความปลอดภัย", color: "bg-outline text-outline" },
    { width: "25%", label: "ง่ายเกินไป", color: "bg-error text-error" },
    { width: "50%", label: "ปานกลาง", color: "bg-secondary text-secondary" },
    { width: "75%", label: "ปลอดภัยดี", color: "bg-primary-fixed text-primary" },
    { width: "100%", label: "ปลอดภัยสูงมาก", color: "bg-primary text-primary" },
  ][password.length === 0 ? 0 : Math.max(1, strength)];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError("กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("รูปแบบอีเมลไม่ถูกต้อง");
      return;
    }
    if (
      normalizedEmail === INITIAL_USER.email.toLowerCase() ||
      (user.email && normalizedEmail === user.email.toLowerCase())
    ) {
      setError("อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบ");
      return;
    }
    if (password.length < 8) {
      setError("รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (password !== confirmPassword) {
      setError("รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }
    if (!terms) {
      setError("กรุณากดยอมรับข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัว");
      return;
    }

    setError("");
    registerUser(email.trim(), name.trim());
  };

  return (
    <AuthShell
      showcaseTitle="เปิดบัญชีเพื่อทดลองอิสรภาพทางการเงิน"
      showcaseSubtitle="ลงทะเบียนฟรีภายใน 1 นาที พร้อมใช้งานกระเป๋าเงินจำลองและผู้ช่วย AI ทันที"
      highlights={HIGHLIGHTS}
      footerBadge="No Credit Card Required"
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-on-surface tracking-tight mb-1.5">
          สร้างบัญชีผู้ใช้ใหม่
        </h1>
        <p className="text-sm text-on-surface-variant">กรอกข้อมูลเบื้องต้นเพื่อเริ่มต้นใช้งานระบบ</p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 p-3 rounded-lg border border-error/40 bg-error-container/20 text-on-error-container text-xs flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[16px] text-error shrink-0">error</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="reg-name"
            className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5"
          >
            ชื่อ-นามสกุล (Full Name)
          </label>
          <input
            id="reg-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="คุณธนภัทร วงศ์เจริญ"
            className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2.5 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
          />
        </div>

        <div>
          <label
            htmlFor="reg-email"
            className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5"
          >
            อีเมล (Email Address)
          </label>
          <input
            id="reg-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="thanapat@example.com"
            className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2.5 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
          />
        </div>

        <div>
          <label
            htmlFor="reg-pass"
            className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5"
          >
            รหัสผ่าน (Password)
          </label>
          <div className="relative">
            <input
              id="reg-pass"
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="อย่างน้อย 8 ตัวอักษร"
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 pr-11 py-2.5 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface p-1"
              aria-label="แสดงหรือซ่อนรหัสผ่าน"
            >
              <span className="material-symbols-outlined text-[18px]">
                {showPass ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1 flex-1 rounded-full bg-surface-container-highest overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${strengthMeta.color.split(" ")[0]}`}
                style={{ width: strengthMeta.width }}
              />
            </div>
            <span className={`text-[11px] font-mono ${strengthMeta.color.split(" ")[1]}`}>
              {strengthMeta.label}
            </span>
          </div>
        </div>

        <div>
          <label
            htmlFor="reg-confirm"
            className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5"
          >
            ยืนยันรหัสผ่าน (Confirm Password)
          </label>
          <input
            id="reg-confirm"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="กรอกรหัสผ่านอีกครั้ง"
            className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2.5 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
          />
        </div>

        <div className="flex items-start gap-2 pt-1">
          <input
            id="reg-terms"
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-outline-variant/60 accent-primary cursor-pointer"
          />
          <span className="text-xs text-on-surface-variant leading-relaxed">
            <label htmlFor="reg-terms" className="cursor-pointer select-none">
              ฉันได้อ่านและยอมรับ
            </label>{" "}
            <button
              type="button"
              onClick={() => setTermsModalOpen(true)}
              className="font-semibold text-primary hover:underline"
            >
              ข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัวของ Finora
            </button>
          </span>
        </div>

        <button
          type="submit"
          className="w-full mt-2 py-2.5 px-4 rounded-lg bg-primary-container text-on-primary-container font-semibold text-sm hover:opacity-90 flex items-center justify-center gap-2 shadow-sm"
        >
          <span>สร้างบัญชีและเริ่มต้นใช้งาน</span>
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-outline-variant/20 text-center">
        <p className="text-xs text-on-surface-variant">
          มีบัญชี Finora อยู่แล้ว?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline ml-1">
            เข้าสู่ระบบ (Sign In)
          </Link>
        </p>
      </div>

      {termsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-backdrop-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="terms-modal-title"
          onClick={() => setTermsModalOpen(false)}
        >
          <div
            ref={termsDialogRef}
            tabIndex={-1}
            className="w-full max-w-lg rounded-xl bg-surface-container border border-outline-variant/40 shadow-2xl overflow-hidden animate-modal-in focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30">
              <h2 id="terms-modal-title" className="text-base font-semibold text-on-surface m-0">
                ข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัว
              </h2>
              <button
                type="button"
                aria-label="ปิดหน้าต่าง"
                onClick={() => setTermsModalOpen(false)}
                className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="p-6 space-y-3 text-xs text-on-surface-variant leading-relaxed max-h-[60vh] overflow-y-auto">
              <p>
                <strong className="text-on-surface">1. การจัดเก็บข้อมูลส่วนบุคคล:</strong> ข้อมูลรายรับ-รายจ่าย หมวดหมู่ และรายการประจำทั้งหมดถูกเก็บไว้ในเบราว์เซอร์ของคุณ (localStorage) และประวัติแชทถูกเก็บใน sessionStorage เท่านั้น
              </p>
              <p>
                <strong className="text-on-surface">2. การประมวลผลด้วย AI:</strong> เมื่อคุณส่งข้อความหรืออัปโหลดสลิป ระบบจะส่งข้อมูลที่จำเป็นไปยังผู้ให้บริการโมเดลผ่าน OpenRouter (และบริการ OCR สำหรับสลิป) เพื่อวิเคราะห์ข้อมูลเท่านั้น
              </p>
              <p>
                <strong className="text-on-surface">3. ความปลอดภัยและสภาพแวดล้อม Sandbox:</strong> Finora ใช้สำหรับบันทึกรายรับ-รายจ่ายและทดลองวางแผนการเงิน โดยไม่มีการเชื่อมต่อบัญชีธนาคารจริงหรือตัดเงินจริง
              </p>
            </div>
            <div className="px-6 py-4 flex items-center justify-end gap-2 bg-surface-container-low/40 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={() => {
                  setTerms(true);
                  setTermsModalOpen(false);
                }}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary-container text-on-primary-container hover:opacity-90"
              >
                ยอมรับและปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
