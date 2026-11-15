"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useFinora } from "@/context/FinoraContext";
import { formatTHB } from "@/lib/seed";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
}

const SUGGESTIONS = [
  "วิเคราะห์รายจ่ายเดือนนี้ของฉันให้หน่อย ควรลดหมวดไหน?",
  "ด้วยเงินคงเหลือและรายรับตอนนี้ ฉันควรออมเงินเดือนละเท่าไหร่ดี?",
  "ช่วยสรุปภาระค่าบริการตัดเงินอัตโนมัติ (Recurring) ของฉัน",
];

export default function AiAssistantPage() {
  const { bankBalance, transactions, categories, recurring, settings } = useFinora();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "สวัสดีครับ ผมคือผู้ช่วยการเงิน Finora AI (ขับเคลื่อนด้วย Google Gemini) สามารถถามคำถามเกี่ยวกับงบประมาณ รายรับรายจ่าย หรือขอคำแนะนำการออมจากข้อมูลจริงของคุณได้เลยครับ",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const financialSummary = useMemo(() => {
    const income = transactions
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + t.amount, 0);
    const expense = transactions
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + t.amount, 0);
    const recSum = recurring.filter((r) => r.active).reduce((s, r) => s + r.amount, 0);
    const catBreakdown = categories
      .filter((c) => c.type === "expense")
      .map((c) => {
        const sum = transactions
          .filter((t) => t.categoryId === c.id)
          .reduce((s, t) => s + t.amount, 0);
        return `- ${c.name}: ใช้ไป ${formatTHB(sum)} (งบ ${formatTHB(c.budget)})`;
      })
      .join("\n");

    return [
      `ยอดเงินคงเหลือ Virtual Wallet: ${formatTHB(bankBalance)}`,
      `รายรับรวม: ${formatTHB(income)}`,
      `รายจ่ายรวม: ${formatTHB(expense)}`,
      `รายจ่ายประจำ (Recurring ที่เปิดอยู่): ${formatTHB(recSum)}/เดือน`,
      `รายละเอียดตามหมวดหมู่:\n${catBreakdown}`,
    ].join("\n");
  }, [bankBalance, transactions, categories, recurring]);

  const sendPrompt = async (promptText: string) => {
    const text = promptText.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          apiKeyOverride: settings.geminiApiKeyOverride,
          financialSummary,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { id: `e-${Date.now()}`, role: "error", text: data.error || "ไม่สามารถเชื่อมต่อ AI ได้" },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: "assistant", text: data.reply },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, role: "error", text: "เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight m-0">
            ผู้ช่วย AI การเงินส่วนบุคคล (Gemini)
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            วิเคราะห์ข้อมูลรายรับ-รายจ่ายและยอดเงินปัจจุบันของคุณโดยตรง
          </p>
        </div>
        <Link
          href="/settings"
          className="text-xs font-semibold text-primary hover:underline self-start sm:self-auto"
        >
          ตั้งค่า Gemini API Key →
        </Link>
      </div>

      {/* Quick Suggestions */}
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={loading}
            onClick={() => sendPrompt(s)}
            className="text-xs px-3 py-1.5 rounded-full bg-surface-container border border-outline-variant/40 text-on-surface-variant hover:text-on-surface hover:border-primary/50 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Chat Stream */}
      <div className="rounded-2xl bg-surface-container border border-outline-variant/30 p-5 flex flex-col gap-4 min-h-[420px]">
        <div className="flex-1 space-y-4 overflow-y-auto max-h-[520px] pr-1">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-primary-container text-on-primary-container font-medium"
                    : m.role === "error"
                    ? "bg-error-container/20 border border-error/40 text-on-error-container"
                    : "bg-surface-container-low border border-outline-variant/20 text-on-surface"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="text-xs text-on-surface-variant font-mono">
              กำลังวิเคราะห์ข้อมูลการเงินด้วย Gemini...
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendPrompt(input);
          }}
          className="pt-3 border-t border-outline-variant/30 flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="พิมพ์คำถามเกี่ยวกับการเงินของคุณ..."
            className="flex-1 bg-surface-container-low border border-outline-variant/40 rounded-lg px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-5 py-2.5 rounded-lg bg-primary-container text-on-primary-container text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            ส่ง
          </button>
        </form>
      </div>
    </div>
  );
}
