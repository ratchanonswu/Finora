"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { useFinora } from "@/context/FinoraContext";

const HIGHLIGHTS = [
  {
    icon: "auto_awesome",
    title: "AI Financial Intelligence",
    desc: "จำแนกหมวดหมู่ สรุปงบประมาณ และพยากรณ์เงินออมสิ้นเดือน",
  },
  {
    icon: "account_balance",
    title: "Virtual Bank Simulator",
    desc: "ทดสอบการตัดเงินอัตโนมัติและการจัดสรรเงินใน Sandbox ปลอดภัย",
  },
  {
    icon: "document_scanner",
    title: "AI Slip Verification",
    desc: "สแกนและตรวจสอบข้อมูลสลิปธุรกรรมอย่างรวดเร็ว",
  },
];

export default function LoginPage() {
  const { loginUser } = useFinora();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");

  const handleQuickDemo = () => {
    setEmail("thanapat@finora.io");
    setPassword("Finora2025!Demo");
    setError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("รูปแบบอีเมลไม่ถูกต้อง");
      return;
    }
    setError("");
    loginUser(email.trim(), undefined, remember);
  };

  return (
    <AuthShell
      showcaseTitle="ระบบจัดการการเงินอัจฉริยะ สำหรับผู้ต้องการเติบโต"
      showcaseSubtitle="วิเคราะห์รายรับรายจ่ายอัตโนมัติด้วย AI ควบคู่กับ Virtual Bank จำลองพอร์ตการเงินเสมือนจริงอย่างไร้รอยต่อ"
      highlights={HIGHLIGHTS}
      footerBadge="FinTech-grade Security"
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-on-surface tracking-tight mb-1.5">เข้าสู่ระบบ</h1>
        <p className="text-sm text-on-surface-variant">
          กรอกข้อมูลบัญชีเพื่อเข้าจัดการแดชบอร์ดการเงินของคุณ
        </p>
      </div>

      {/* Quick Demo Fill */}
      <div className="mb-6 p-3.5 rounded-lg border border-primary/30 bg-primary-container/10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[20px] text-primary">science</span>
          <div>
            <p className="text-xs font-semibold text-on-surface">บัญชีทดสอบ Sandbox (Demo)</p>
            <p className="text-[11px] text-on-surface-variant">คลิกเพื่อกรอกข้อมูลบัญชีตัวอย่างอัตโนมัติ</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleQuickDemo}
          className="px-3 py-1.5 rounded-md bg-primary-container text-on-primary-container text-xs font-semibold hover:opacity-90 shrink-0"
        >
          กรอกอัตโนมัติ
        </button>
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
            htmlFor="login-email"
            className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5"
          >
            อีเมล (Email)
          </label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[18px]">
              mail
            </span>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@finora.io"
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg pl-10 pr-4 py-2.5 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="login-password"
              className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider"
            >
              รหัสผ่าน (Password)
            </label>
            <Link href="/forgot-password" className="text-xs text-primary hover:underline font-medium">
              ลืมรหัสผ่าน?
            </Link>
          </div>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[18px]">
              key
            </span>
            <input
              id="login-password"
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg pl-10 pr-11 py-2.5 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              aria-label="แสดงหรือซ่อนรหัสผ่าน"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface p-1"
            >
              <span className="material-symbols-outlined text-[18px]">
                {showPass ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="w-4 h-4 rounded border-outline-variant/60 accent-primary"
          />
          <span className="text-xs text-on-surface-variant">จดจำการเข้าสู่ระบบไว้ในอุปกรณ์นี้</span>
        </label>

        <button
          type="submit"
          className="w-full mt-2 py-2.5 px-4 rounded-lg bg-primary-container text-on-primary-container font-semibold text-sm hover:opacity-90 flex items-center justify-center gap-2 shadow-sm"
        >
          <span>เข้าสู่ระบบ</span>
          <span className="material-symbols-outlined text-[18px]">login</span>
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-outline-variant/20 text-center">
        <p className="text-xs text-on-surface-variant">
          ยังไม่มีบัญชีใช้งาน Finora?{" "}
          <Link href="/register" className="font-semibold text-primary hover:underline ml-1">
            สร้างบัญชีใหม่ (Register)
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
