"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useFinora } from "@/context/FinoraContext";
import { formatTHB, parsePromptPayPayload } from "@/lib/seed";
import { decodeQrImage } from "@/lib/qr-decoder";
import {
  describeWriteTool,
  READ_TOOL_NAMES,
  runReadTool,
  WRITE_TOOL_NAMES,
} from "@/lib/ai-tools";
import type { OpenRouterMessage, OpenRouterToolCall } from "@/lib/openrouter";
import type { ChatMessage, TransactionType } from "@/lib/types";

const SUGGESTIONS = [
  "วิเคราะห์รายจ่ายเดือนนี้ของฉันให้หน่อย ควรลดหมวดไหน?",
  "ด้วยเงินคงเหลือและรายรับตอนนี้ ฉันควรออมเงินเดือนละเท่าไหร่ดี?",
  "ช่วยสรุปภาระค่าบริการตัดเงินอัตโนมัติ (Recurring) ของฉัน",
];

function guessCategoryId(text: string, type: TransactionType): string {
  if (type === "income") {
    return /ปันผล|หุ้น|กองทุน|ดอกเบี้ย|invest|dividend/i.test(text) ? "investment" : "salary";
  }
  const lower = text.toLowerCase();
  if (/bts|mrt|grab|taxi|oil|shell|ptt|เดินทาง|รถ/.test(lower)) return "transport";
  if (/uniqlo|apple|mall|shop|lazada|shopee|central/.test(lower)) return "shopping";
  if (/netflix|spotify|youtube|game|movie/.test(lower)) return "entertainment";
  if (/condo|rent|ais|true|water|electric|บิล|ค่าไฟ|ค่าเช่า/.test(lower)) return "housing";
  return "food";
}

// Parses **หัวข้อ**, ** หัวข้อ ** (with spaces), `code`, headings, and bullet lists without external deps.
function renderInline(line: string): React.ReactNode[] {
  const tokenRegex = /(\*\*\s*[^*]+?\s*\*\*|`[^`]+`)/g;
  return line.split(tokenRegex).map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-on-surface">
          {part.slice(2, -2).trim()}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-surface-container-highest font-mono text-xs"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function renderChatMarkdown(text: string): React.ReactNode {
  const blocks = text.split(/(```[\s\S]*?```)/g);
  return blocks.map((block, bIdx) => {
    if (block.startsWith("```") && block.endsWith("```")) {
      const code = block.replace(/^```[a-zA-Z0-9_-]*\n?/, "").replace(/```$/, "");
      return (
        <pre
          key={bIdx}
          className="my-2 p-3 rounded-lg bg-surface-container-highest font-mono text-xs overflow-x-auto"
        >
          <code>{code}</code>
        </pre>
      );
    }
    return (
      <div key={bIdx} className="space-y-1">
        {block.split("\n").map((line, lIdx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={lIdx} className="h-1.5" />;
          const headingMatch = trimmed.match(/^#{1,4}\s+(.+)$/);
          if (headingMatch) {
            return (
              <div key={lIdx} className="font-bold text-on-surface pt-1.5 pb-0.5">
                {renderInline(headingMatch[1])}
              </div>
            );
          }
          const bulletMatch = trimmed.match(/^([*\-•])\s+(.+)$/);
          if (bulletMatch) {
            return (
              <div key={lIdx} className="flex items-start gap-2 pl-1">
                <span className="text-primary select-none">•</span>
                <span>{renderInline(bulletMatch[2])}</span>
              </div>
            );
          }
          return <div key={lIdx}>{renderInline(line)}</div>;
        })}
      </div>
    );
  });
}

export default function AiAssistantPage() {
  const {
    bankBalance,
    transactions,
    categories,
    recurring,
    settings,
    chatMessages,
    appendChatMessage,
    updateChatMessage,
    clearChatMessages,
    undoChatTransaction,
    addTransaction,
    updateCategoryBudget,
    toggleRecurring,
    executeBankAction,
  } = useFinora();

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingAmounts, setPendingAmounts] = useState<Record<string, string>>({});

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
      `วันที่ปัจจุบัน: ${new Date().toLocaleDateString("th-TH", { dateStyle: "long" })}`,
      `ยอดเงินคงเหลือ Virtual Wallet: ${formatTHB(bankBalance)}`,
      `รายรับรวม: ${formatTHB(income)}`,
      `รายจ่ายรวม: ${formatTHB(expense)}`,
      `รายจ่ายประจำ (Recurring ที่เปิดอยู่): ${formatTHB(recSum)}/เดือน`,
      `รายละเอียดตามหมวดหมู่:\n${catBreakdown}`,
    ].join("\n");
  }, [bankBalance, transactions, categories, recurring]);

  const runToolLoop = async (initialHistory: OpenRouterMessage[]) => {
    const history = [...initialHistory];
    const snapshot = { bankBalance, transactions, categories, recurring };

    for (let step = 0; step < 4; step++) {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          apiKeyOverride: settings.geminiApiKeyOverride,
          financialSummary,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        appendChatMessage({
          id: `e-${Date.now()}`,
          role: "error",
          text: data.error || "ไม่สามารถเชื่อมต่อ AI ได้",
        });
        return;
      }

      const toolCalls: OpenRouterToolCall[] | undefined = data.toolCalls;
      if (!toolCalls || toolCalls.length === 0) {
        appendChatMessage({
          id: `a-${Date.now()}`,
          role: "assistant",
          text: data.reply,
        });
        return;
      }

      history.push({ role: "assistant", content: data.reply || null, tool_calls: toolCalls });

      let hasWrite = false;
      for (const tc of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          args = {};
        }

        if (READ_TOOL_NAMES.has(tc.function.name)) {
          const out = runReadTool(tc.function.name, args, snapshot);
          history.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(out) });
        } else if (WRITE_TOOL_NAMES.has(tc.function.name)) {
          hasWrite = true;
          const summary = describeWriteTool(tc.function.name, args, snapshot);
          appendChatMessage({
            id: `t-${Date.now()}-${tc.id}`,
            role: "assistant",
            text: `ฟิโนร่าเตรียมดำเนินการนี้ให้เรียบร้อยแล้วค่ะ กรุณาตรวจสอบและกดยืนยันด้านล่างนะคะ`,
            pendingTool: {
              toolCallId: tc.id,
              name: tc.function.name,
              args,
              summary,
              status: "pending",
            },
          });
        }
      }

      if (hasWrite) return;
    }
  };

  const sendPrompt = async (promptText: string) => {
    const text = promptText.trim();
    if (!text || loading) return;

    appendChatMessage({ id: `u-${Date.now()}`, role: "user", text });
    setInput("");
    setLoading(true);

    try {
      const prior: OpenRouterMessage[] = chatMessages
        .filter((m) => m.id !== "welcome" && (m.role === "user" || m.role === "assistant"))
        .slice(-8)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.text }));
      await runToolLoop([...prior, { role: "user", content: text }]);
    } catch {
      appendChatMessage({
        id: `e-${Date.now()}`,
        role: "error",
        text: "เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmTool = async (msg: ChatMessage) => {
    const pt = msg.pendingTool;
    if (!pt || pt.status !== "pending" || loading) return;

    setLoading(true);
    let resultText = "";
    try {
      if (pt.name === "add_transaction") {
        const res = await addTransaction({
          type: pt.args.type === "income" ? "income" : "expense",
          title: String(pt.args.title || "รายการจาก AI"),
          amount: Number(pt.args.amount) || 0,
          categoryId: String(pt.args.categoryId || (pt.args.type === "income" ? "salary" : "food")),
          channel: String(pt.args.channel || "Virtual Bank Wallet"),
          date: new Date().toISOString(),
        });
        resultText = res.ok
          ? `บันทึกสำเร็จ: ${pt.summary}`
          : `บันทึกไม่สำเร็จ: ${res.error}`;
      } else if (pt.name === "update_category_budget") {
        updateCategoryBudget(String(pt.args.categoryId), Number(pt.args.budget) || 0);
        resultText = `อัปเดตสำเร็จ: ${pt.summary}`;
      } else if (pt.name === "toggle_recurring") {
        toggleRecurring(String(pt.args.recurringId));
        resultText = `อัปเดตสำเร็จ: ${pt.summary}`;
      } else if (pt.name === "virtual_bank_transfer") {
        const res = await executeBankAction(
          pt.args.type === "credit" ? "credit" : "debit",
          Number(pt.args.amount) || 0,
          String(pt.args.title || ""),
          String(pt.args.counterparty || "Finora Sandbox")
        );
        resultText = res.ok
          ? `ทำรายการสำเร็จ: ${pt.summary}`
          : `ทำรายการไม่สำเร็จ: ${res.error}`;
      }

      updateChatMessage(msg.id, { pendingTool: { ...pt, status: "confirmed" } });
      appendChatMessage({
        id: `a-${Date.now()}`,
        role: "assistant",
        text: `${resultText} เรียบร้อยแล้วค่ะ`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelTool = (msg: ChatMessage) => {
    const pt = msg.pendingTool;
    if (!pt || pt.status !== "pending") return;
    updateChatMessage(msg.id, { pendingTool: { ...pt, status: "cancelled" } });
  };

  const handleQrOrSlipFile = async (file: File) => {
    if (loading) return;
    setLoading(true);

    try {
      const { qrRaw, imageBase64, mimeType, thumbnailDataUrl } = await decodeQrImage(file);
      appendChatMessage({
        id: `u-${Date.now()}`,
        role: "user",
        text: `ส่งรูปภาพ QR / สลิป (${file.name})`,
        thumbnailUrl: thumbnailDataUrl,
      });

      const tlv = qrRaw ? parsePromptPayPayload(qrRaw) : {};
      let vision: {
        isValidPaymentImage?: boolean;
        type?: TransactionType;
        merchant?: string;
        promptPayId?: string;
        amount?: number;
        categoryId?: string;
      } | null = null;

      let visionError = "";
      try {
        const res = await fetch("/api/ai/qr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64,
            mimeType,
            qrRaw,
            categories: categories.map((c) => ({ id: c.id, name: c.name, type: c.type })),
            apiKeyOverride: settings.geminiApiKeyOverride,
          }),
        });
        if (res.ok) {
          vision = await res.json();
        } else {
          const errBody = await res.json().catch(() => ({}));
          visionError = errBody?.error || `AI Error (${res.status})`;
        }
      } catch {
        visionError = "ไม่สามารถเชื่อมต่อบริการ AI ได้";
      }

      if (!qrRaw && !vision?.isValidPaymentImage) {
        appendChatMessage({
          id: `e-${Date.now()}`,
          role: "error",
          text: visionError
            ? `ไม่สามารถอ่านรูปภาพด้วย AI ได้ (${visionError})`
            : "ไม่พบ QR Code หรือข้อมูลการชำระเงินในรูปภาพนี้ กรุณาอัปโหลดรูปป้าย QR หรือสลิปธนาคารที่ชัดเจนนะคะ",
        });
        return;
      }

      const txType: TransactionType = vision?.type === "income" ? "income" : "expense";
      const merchant =
        tlv.merchant ||
        vision?.merchant ||
        (tlv.isPromptPayOrSlip ? "ร้านค้า PromptPay" : qrRaw?.slice(0, 40) || "รายการสแกน QR");
      const promptPayId =
        tlv.promptPayId || vision?.promptPayId || (qrRaw ? qrRaw.slice(0, 20) : "-");
      const amount =
        typeof tlv.amount === "number" && tlv.amount > 0
          ? tlv.amount
          : typeof vision?.amount === "number" && vision.amount > 0
          ? vision.amount
          : 0;

      const matchingCategories = categories.filter((c) => c.type === txType);
      const validCategory =
        vision?.categoryId && matchingCategories.some((c) => c.id === vision?.categoryId)
          ? vision.categoryId
          : guessCategoryId(merchant, txType);
      const catName =
        categories.find((c) => c.id === validCategory)?.name || validCategory;

      if (amount > 0) {
        const saveRes = await addTransaction({
          title: merchant,
          amount,
          type: txType,
          categoryId: validCategory,
          channel: "สแกน QR / สลิป (AI Chat)",
          date: new Date().toISOString(),
        });

        if (!saveRes.ok) {
          appendChatMessage({
            id: `e-${Date.now()}`,
            role: "error",
            text: `ตรวจสอบสลิปสำเร็จ (${merchant} ยอด ${formatTHB(amount)}) แต่บันทึกไม่สำเร็จ: ${saveRes.error}`,
          });
          return;
        }

        appendChatMessage({
          id: `a-${Date.now()}`,
          role: "assistant",
          text: `ตรวจสอบรูปภาพเรียบร้อยแล้วค่ะ ฟิโนร่าจัดหมวดหมู่เป็น **${catName}** และบันทึกเป็น**${
            txType === "income" ? "รายรับ" : "รายจ่าย"
          }** จำนวน **${formatTHB(amount)}** ให้เรียบร้อยแล้วค่ะ`,
          txAction: {
            transactionId: saveRes.transactionId,
            status: "saved",
            type: txType,
            merchant,
            promptPayId,
            amount,
            categoryId: validCategory,
          },
        });
      } else {
        appendChatMessage({
          id: `a-${Date.now()}`,
          role: "assistant",
          text: `สแกนป้าย QR ของ **${merchant}** สำเร็จค่ะ (จัดหมวดหมู่แนะนำ: **${catName}**) เนื่องจากใน QR ไม่ได้ระบุยอดเงินไว้ กรุณากรอกจำนวนเงินด้านล่างเพื่อบันทึกรายการนะคะ`,
          txAction: {
            status: "needs_amount",
            type: txType,
            merchant,
            promptPayId,
            amount: 0,
            categoryId: validCategory,
          },
        });
      }
    } catch {
      appendChatMessage({
        id: `e-${Date.now()}`,
        role: "error",
        text: "ไม่สามารถอ่านไฟล์รูปภาพนี้ได้ กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPendingTx = async (msg: ChatMessage) => {
    const action = msg.txAction;
    if (!action) return;
    const rawAmount = Number(pendingAmounts[msg.id] ?? action.amount);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) return;

    setLoading(true);
    const saveRes = await addTransaction({
      title: action.merchant.trim() || "รายการสแกน QR",
      amount: rawAmount,
      type: action.type,
      categoryId: action.categoryId,
      channel: "สแกน QR / สลิป (AI Chat)",
      date: new Date().toISOString(),
    });
    setLoading(false);

    if (!saveRes.ok) {
      appendChatMessage({
        id: `e-${Date.now()}`,
        role: "error",
        text: saveRes.error || "ไม่สามารถบันทึกรายการได้",
      });
      return;
    }

    updateChatMessage(msg.id, {
      txAction: {
        ...action,
        amount: rawAmount,
        transactionId: saveRes.transactionId,
        status: "saved",
      },
    });
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
    if (file) {
      e.preventDefault();
      handleQrOrSlipFile(file);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight m-0">
            ผู้ช่วย AI &amp; สแกน QR / สลิปอัตโนมัติ
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            ถามคำถามการเงิน หรือส่งรูป QR Code / สลิปธนาคารเพื่อให้บอทจัดหมวดหมู่และบันทึกรายรับ-รายจ่ายทันที
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            type="button"
            onClick={clearChatMessages}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant/40 text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
            <span>ล้างแชท</span>
          </button>
          <Link href="/settings" className="text-xs font-semibold text-primary hover:underline">
            ตั้งค่า API Key →
          </Link>
        </div>
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
      <div className="rounded-2xl bg-surface-container border border-outline-variant/30 p-5 flex flex-col gap-4 min-h-[460px]">
        <div className="flex-1 space-y-4 overflow-y-auto max-h-[540px] pr-1">
          {chatMessages.map((m) => {
            const action = m.txAction;
            const catName = action
              ? categories.find((c) => c.id === action.categoryId)?.name || action.categoryId
              : "";

            return (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary-container text-on-primary-container font-medium whitespace-pre-wrap"
                      : m.role === "error"
                      ? "bg-error-container/20 border border-error/40 text-on-error-container whitespace-pre-wrap"
                      : "bg-surface-container-low border border-outline-variant/20 text-on-surface"
                  }`}
                >
                  {m.thumbnailUrl && (
                    <img
                      src={m.thumbnailUrl}
                      alt="Uploaded QR or Slip"
                      className="max-h-32 w-auto rounded-lg mb-2 border border-white/20 bg-white p-1"
                    />
                  )}

                  {m.role === "assistant" ? renderChatMarkdown(m.text) : m.text}

                  {/* Inline Transaction Action (Flattened with border divider to avoid nested cards) */}
                  {action && (
                    <div className="mt-3 pt-3 border-t border-outline-variant/30 text-xs space-y-2.5">
                      {action.status === "saved" && (
                        <>
                          <div className="grid grid-cols-2 gap-y-1 text-on-surface-variant">
                            <span>ประเภท:</span>
                            <span
                              className={`text-right font-semibold ${
                                action.type === "income" ? "text-primary" : "text-secondary"
                              }`}
                            >
                              {action.type === "income" ? "รายรับ (+)" : "รายจ่าย (-)"}
                            </span>
                            <span>รายการ / ร้านค้า:</span>
                            <span className="text-right font-semibold text-on-surface">
                              {action.merchant}
                            </span>
                            <span>หมวดหมู่:</span>
                            <span className="text-right text-on-surface">{catName}</span>
                            <span>จำนวนเงิน:</span>
                            <span className="text-right font-mono font-bold text-on-surface">
                              {formatTHB(action.amount)}
                            </span>
                          </div>
                          <div className="pt-1 flex items-center justify-between">
                            <span className="inline-flex items-center gap-1 text-primary font-semibold">
                              <span className="material-symbols-outlined text-[15px]">
                                check_circle
                              </span>
                              บันทึกในระบบแล้ว
                            </span>
                            <button
                              type="button"
                              onClick={() => undoChatTransaction(m.id)}
                              className="text-error hover:underline font-medium"
                            >
                              ยกเลิกรายการ (Undo)
                            </button>
                          </div>
                        </>
                      )}

                      {action.status === "undone" && (
                        <div className="text-on-surface-variant italic">
                          ยกเลิกรายการ {action.merchant} ({formatTHB(action.amount)}) เรียบร้อยแล้ว
                        </div>
                      )}

                      {action.status === "needs_amount" && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-on-surface-variant">ประเภท &amp; หมวดหมู่:</span>
                            <div className="flex items-center gap-1.5">
                              <select
                                value={action.type}
                                onChange={(e) => {
                                  const nextType = e.target.value as TransactionType;
                                  const firstCat =
                                    categories.find((c) => c.type === nextType)?.id || "food";
                                  updateChatMessage(m.id, {
                                    txAction: { ...action, type: nextType, categoryId: firstCat },
                                  });
                                }}
                                className="bg-surface-container border border-outline-variant/40 rounded px-2 py-1 text-xs text-on-surface"
                              >
                                <option value="expense">รายจ่าย</option>
                                <option value="income">รายรับ</option>
                              </select>
                              <select
                                value={action.categoryId}
                                onChange={(e) =>
                                  updateChatMessage(m.id, {
                                    txAction: { ...action, categoryId: e.target.value },
                                  })
                                }
                                className="bg-surface-container border border-outline-variant/40 rounded px-2 py-1 text-xs text-on-surface"
                              >
                                {categories
                                  .filter((c) => c.type === action.type)
                                  .map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              step="0.01"
                              placeholder="ระบุยอดเงิน (บาท)"
                              value={pendingAmounts[m.id] ?? ""}
                              onChange={(e) =>
                                setPendingAmounts((prev) => ({
                                  ...prev,
                                  [m.id]: e.target.value,
                                }))
                              }
                              className="flex-1 bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-1.5 text-sm font-mono text-on-surface focus:outline-none focus:border-primary"
                            />
                            <button
                              type="button"
                              disabled={loading || !(Number(pendingAmounts[m.id]) > 0)}
                              onClick={() => handleConfirmPendingTx(m)}
                              className="px-3.5 py-1.5 rounded-lg bg-primary-container text-on-primary-container text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                            >
                              บันทึกรายการ
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Write Tool Confirmation Block (Flattened with border divider) */}
                  {m.pendingTool && (
                    <div className="mt-3 pt-3 border-t border-outline-variant/30 text-xs space-y-2.5">
                      <div className="font-semibold text-on-surface">{m.pendingTool.summary}</div>
                      {m.pendingTool.status === "pending" && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleConfirmTool(m)}
                            className="px-3.5 py-1.5 rounded-lg bg-primary-container text-on-primary-container font-semibold hover:opacity-90 disabled:opacity-50"
                          >
                            ยืนยันดำเนินการ
                          </button>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleCancelTool(m)}
                            className="px-3.5 py-1.5 rounded-lg border border-outline-variant/40 text-on-surface-variant hover:text-on-surface"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      )}
                      {m.pendingTool.status === "confirmed" && (
                        <span className="inline-flex items-center gap-1 text-primary font-semibold">
                          <span className="material-symbols-outlined text-[15px]">check_circle</span>
                          ยืนยันและดำเนินการเรียบร้อยแล้ว
                        </span>
                      )}
                      {m.pendingTool.status === "cancelled" && (
                        <span className="text-on-surface-variant italic">ยกเลิกการดำเนินการนี้แล้ว</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="text-xs text-on-surface-variant font-mono">
              กำลังประมวลผลด้วย Finora AI...
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendPrompt(input);
          }}
          className="pt-3 border-t border-outline-variant/30 flex items-center gap-2"
        >
          <label
            title="อัปโหลดรูปภาพ QR Code หรือสลิปโอนเงิน"
            className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface hover:border-primary/60 transition-colors shrink-0 ${
              loading ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <span className="material-symbols-outlined text-[18px] text-primary">
              qr_code_scanner
            </span>
            <span className="hidden sm:inline">ส่ง QR / สลิป</span>
            <input
              type="file"
              accept="image/*"
              disabled={loading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) handleQrOrSlipFile(f);
              }}
              className="hidden"
            />
          </label>

          <input
            type="text"
            value={input}
            onPaste={handlePaste}
            onChange={(e) => setInput(e.target.value)}
            placeholder="พิมพ์คำถาม หรือวางรูป QR/สลิป (Ctrl+V)..."
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
