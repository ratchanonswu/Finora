"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useFinora } from "@/context/FinoraContext";
import { formatTHB, parsePromptPayPayload } from "@/lib/seed";
import { decodeQrImage } from "@/lib/qr-decoder";
import {
  describeWriteTool,
  getToolExecutionPriority,
  READ_TOOL_NAMES,
  runReadTool,
  validateAndNormalizeWriteTool,
  WRITE_TOOL_NAMES,
} from "@/lib/ai-tools";
import type { OpenRouterMessage, OpenRouterToolCall } from "@/lib/openrouter";
import type { Category, ChatMessage, TransactionType } from "@/lib/types";

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

type TableAlign = "left" | "center" | "right";

function splitTableRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.split("|").map((cell) => cell.trim());
}

function parseTableSeparator(line: string): TableAlign[] | null {
  if (!line.includes("|")) return null;
  const cells = splitTableRow(line);
  if (cells.length === 0) return null;
  const alignments: TableAlign[] = [];
  for (const cell of cells) {
    if (!/^:?-{2,}:?$/.test(cell)) return null;
    if (cell.startsWith(":") && cell.endsWith(":")) alignments.push("center");
    else if (cell.endsWith(":")) alignments.push("right");
    else alignments.push("left");
  }
  return alignments;
}

function tableAlignClass(align: TableAlign | undefined): string {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
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

    const lines = block.split("\n");
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (i + 1 < lines.length && trimmed.includes("|")) {
        const alignments = parseTableSeparator(lines[i + 1]);
        if (alignments) {
          const headers = splitTableRow(line);
          if (headers.length === alignments.length) {
            const rows: string[][] = [];
            let j = i + 2;
            while (
              j < lines.length &&
              lines[j].trim().includes("|") &&
              !parseTableSeparator(lines[j])
            ) {
              rows.push(splitTableRow(lines[j]));
              j++;
            }

            elements.push(
              <div
                key={`tbl-${i}`}
                className="my-2 overflow-x-auto rounded-lg border border-outline-variant/30 bg-surface-container"
              >
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant/30 bg-surface-container-high/60">
                      {headers.map((header, hIdx) => (
                        <th
                          key={hIdx}
                          className={`px-3 py-2 font-semibold text-on-surface whitespace-nowrap ${tableAlignClass(alignments[hIdx])}`}
                        >
                          {renderInline(header)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-surface-container-high/30">
                        {headers.map((_, cIdx) => (
                          <td
                            key={cIdx}
                            className={`px-3 py-2 text-on-surface ${tableAlignClass(alignments[cIdx])}`}
                          >
                            {renderInline(row[cIdx] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
            i = j;
            continue;
          }
        }
      }

      if (!trimmed) {
        elements.push(<div key={i} className="h-1.5" />);
      } else {
        const headingMatch = trimmed.match(/^#{1,4}\s+(.+)$/);
        if (headingMatch) {
          elements.push(
            <div key={i} className="font-bold text-on-surface pt-1.5 pb-0.5">
              {renderInline(headingMatch[1])}
            </div>
          );
        } else {
          const bulletMatch = trimmed.match(/^([*\-•])\s+(.+)$/);
          if (bulletMatch) {
            elements.push(
              <div key={i} className="flex items-start gap-2 pl-1">
                <span className="text-primary select-none">•</span>
                <span>{renderInline(bulletMatch[2])}</span>
              </div>
            );
          } else {
            elements.push(<div key={i}>{renderInline(line)}</div>);
          }
        }
      }
      i++;
    }

    return (
      <div key={bIdx} className="space-y-1">
        {elements}
      </div>
    );
  });
}

interface PendingQrDraft {
  thumbnailUrl: string;
  type: TransactionType;
  merchant: string;
  sender?: string;
  receiver?: string;
  promptPayId: string;
  amount: string;
  categoryId: string;
  needsAmount: boolean;
  error?: string;
}

export default function AiAssistantPage() {
  const {
    user,
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
    addRecurring,
    toggleRecurring,
    executeBankAction,
  } = useFinora();

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<"chat" | "qr_scan" | "saving" | null>(null);
  const [pendingAmounts, setPendingAmounts] = useState<Record<string, string>>({});
  const [pendingQrDraft, setPendingQrDraft] = useState<PendingQrDraft | null>(null);

  const hasPendingConfirmation = useMemo(
    () =>
      pendingQrDraft !== null ||
      chatMessages.some(
        (m) =>
          m.pendingTool?.status === "pending" ||
          m.txAction?.status === "pending" ||
          m.txAction?.status === "needs_amount"
      ),
    [pendingQrDraft, chatMessages]
  );
  const inputLocked = loading || hasPendingConfirmation;

  const buildFinancialSummary = (cats: Category[]) => {
    const income = transactions
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + t.amount, 0);
    const expense = transactions
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + t.amount, 0);
    const recSum = recurring.filter((r) => r.active).reduce((s, r) => s + r.amount, 0);
    const catBreakdown = cats
      .filter((c) => c.type === "expense")
      .map((c) => {
        const sum = transactions
          .filter((t) => t.categoryId === c.id)
          .reduce((s, t) => s + t.amount, 0);
        return `- [${c.id}] ${c.name}: ใช้ไป ${formatTHB(sum)} (งบ ${formatTHB(c.budget)})`;
      })
      .join("\n");
    const incomeCats = cats
      .filter((c) => c.type === "income")
      .map((c) => `[${c.id}] ${c.name}`)
      .join(", ");
    const recList =
      recurring
        .map((r) => `[${r.id}] ${r.title} (${formatTHB(r.amount)}, ${r.active ? "เปิด" : "พัก"})`)
        .join(", ") || "ไม่มี";

    return [
      `วันที่ปัจจุบัน: ${new Date().toLocaleDateString("th-TH", { dateStyle: "long" })}`,
      `ยอดเงินคงเหลือ Virtual Wallet: ${formatTHB(bankBalance)}`,
      `รายรับรวม: ${formatTHB(income)}`,
      `รายจ่ายรวม: ${formatTHB(expense)}`,
      `รายจ่ายประจำ (Recurring ที่เปิดอยู่): ${formatTHB(recSum)}/เดือน`,
      `รายการ Recurring: ${recList}`,
      `หมวดรายจ่ายที่มี:\n${catBreakdown}`,
      `หมวดรายรับที่มี: ${incomeCats}`,
    ].join("\n");
  };

  const financialSummary = useMemo(
    () => buildFinancialSummary(categories),
    [bankBalance, transactions, categories, recurring]
  );

  const runToolLoop = async (
    initialHistory: OpenRouterMessage[],
    overrideCategories?: Category[]
  ) => {
    const history = [...initialHistory];
    const activeCategories = overrideCategories ?? categories;
    const summaryText = overrideCategories
      ? buildFinancialSummary(overrideCategories)
      : financialSummary;
    const snapshot = {
      bankBalance,
      transactions,
      categories: activeCategories,
      recurring,
      autoDebitOnExpense: settings.autoDebitOnExpense,
      quotaResetAt: settings.quotaResetAt,
    };

    for (let step = 0; step < 4; step++) {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          apiKeyOverride: settings.geminiApiKeyOverride,
          financialSummary: summaryText,
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

      const parsedCalls = toolCalls
        .map((tc) => {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments || "{}");
          } catch {
            args = {};
          }
          return { tc, args };
        })
        .sort(
          (a, b) =>
            getToolExecutionPriority(a.tc.function.name, a.args) -
            getToolExecutionPriority(b.tc.function.name, b.args)
        );

      let hasWrite = false;
      for (const { tc, args } of parsedCalls) {

        if (READ_TOOL_NAMES.has(tc.function.name)) {
          const out = runReadTool(tc.function.name, args, snapshot);
          history.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(out) });
        } else if (WRITE_TOOL_NAMES.has(tc.function.name)) {
          // Process one write confirmation at a time so chained steps (e.g. credit -> debit) see updated state.
          if (hasWrite) continue;
          const check = validateAndNormalizeWriteTool(tc.function.name, args, snapshot);
          if (!check.ok) {
            history.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify({ error: check.error }),
            });
          } else {
            hasWrite = true;
            const continueAfterConfirm = toolCalls.length > 1;
            appendChatMessage({
              id: `t-${Date.now()}-${tc.id}`,
              role: "assistant",
              text: `ฟิโนร่าเตรียมดำเนินการนี้ให้เรียบร้อยแล้วค่ะ กรุณาตรวจสอบและกดยืนยันด้านล่างนะคะ`,
              pendingTool: {
                toolCallId: tc.id,
                name: tc.function.name,
                args: check.args,
                summary: check.summary,
                status: "pending",
                continueAfterConfirm,
              },
            });
          }
        }
      }

      if (hasWrite) return;
    }
  };

  const sendPrompt = async (promptText: string) => {
    const text = promptText.trim();
    if (!text || inputLocked) return;

    appendChatMessage({ id: `u-${Date.now()}`, role: "user", text });
    setInput("");
    setLoading(true);
    setLoadingStage("chat");

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
      setLoadingStage(null);
    }
  };

  const handleConfirmTool = async (msg: ChatMessage) => {
    const pt = msg.pendingTool;
    if (!pt || pt.status !== "pending" || loading) return;

    const snapshot = {
      bankBalance,
      transactions,
      categories,
      recurring,
      autoDebitOnExpense: settings.autoDebitOnExpense,
      quotaResetAt: settings.quotaResetAt,
    };
    const check = validateAndNormalizeWriteTool(pt.name, pt.args, snapshot);
    if (!check.ok) {
      appendChatMessage({
        id: `e-${Date.now()}`,
        role: "error",
        text: check.error,
      });
      return;
    }

    setLoading(true);
    let resultText = "";
    let nextCategories = categories;
    try {
      const args = check.args;
      if (pt.name === "add_transaction") {
        const res = await addTransaction({
          type: args.type === "income" ? "income" : "expense",
          title: String(args.title || "รายการจาก AI"),
          amount: Number(args.amount) || 0,
          categoryId: String(args.categoryId || (args.type === "income" ? "salary" : "food")),
          channel: String(args.channel || "Virtual Bank Wallet"),
          date: new Date().toISOString(),
        });
        if (!res.ok) {
          appendChatMessage({
            id: `e-${Date.now()}`,
            role: "error",
            text: `บันทึกไม่สำเร็จ: ${res.error || "ไม่สามารถบันทึกรายการได้"}`,
          });
          return;
        }
        resultText = `บันทึกสำเร็จ: ${check.summary}`;
      } else if (pt.name === "update_category_budget") {
        updateCategoryBudget(String(args.categoryId), Number(args.budget) || 0);
        resultText = `อัปเดตสำเร็จ: ${check.summary}`;
      } else if (pt.name === "toggle_recurring") {
        toggleRecurring(String(args.recurringId));
        resultText = `อัปเดตสำเร็จ: ${check.summary}`;
      } else if (pt.name === "add_recurring_payment") {
        const isInc = args.type === "income";
        addRecurring({
          title: String(args.title),
          amount: Number(args.amount) || 0,
          type: isInc ? "income" : "expense",
          categoryId: String(args.categoryId || (isInc ? "salary" : "recurring")),
          cycle: args.cycle === "weekly" || args.cycle === "yearly" ? args.cycle : "monthly",
          nextDueDate: String(args.nextDueDate),
          active: true,
          icon: String(args.icon || (isInc ? "payments" : "autorenew")),
        });
        resultText = `เพิ่ม${isInc ? "รายรับประจำ" : "รายการตัดเงินอัตโนมัติ"}สำเร็จ: ${check.summary}`;
      } else if (pt.name === "virtual_bank_transfer") {
        const res = await executeBankAction(
          args.type === "credit" ? "credit" : "debit",
          Number(args.amount) || 0,
          String(args.title || ""),
          String(args.counterparty || "Finora Sandbox")
        );
        if (!res.ok) {
          appendChatMessage({
            id: `e-${Date.now()}`,
            role: "error",
            text: `ทำรายการไม่สำเร็จ: ${res.error || "ไม่สามารถทำรายการได้"}`,
          });
          return;
        }
        resultText = `ทำรายการสำเร็จ: ${check.summary}`;
      }

      updateChatMessage(msg.id, {
        pendingTool: { ...pt, args, summary: check.summary, status: "confirmed" },
      });
      const confirmMsg = `${resultText} เรียบร้อยแล้วค่ะ`;
      appendChatMessage({
        id: `a-${Date.now()}`,
        role: "assistant",
        text: confirmMsg,
      });

      if (pt.continueAfterConfirm) {
        const prior: OpenRouterMessage[] = chatMessages
          .filter((m) => m.id !== "welcome" && (m.role === "user" || m.role === "assistant"))
          .slice(-8)
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.text }));
        await runToolLoop(
          [
            ...prior,
            { role: "assistant", content: confirmMsg },
            {
              role: "user",
              content:
                "[ระบบ] ผู้ใช้ยืนยันการดำเนินการข้างต้นเรียบร้อยแล้ว หากยังมีขั้นตอนถัดไปในคำขอก่อนหน้าของ User ให้เรียกใช้ Tool ต่อได้เลย หากครบทุกขั้นตอนแล้วให้ตอบสรุปสั้นๆ ค่ะ",
            },
          ],
          nextCategories
        );
      }
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

  const handleCancelTool = (msg: ChatMessage) => {
    const pt = msg.pendingTool;
    if (!pt || pt.status !== "pending") return;
    updateChatMessage(msg.id, { pendingTool: { ...pt, status: "cancelled" } });
  };

  const handleQrOrSlipFile = async (file: File) => {
    if (inputLocked) return;
    setLoading(true);
    setLoadingStage("qr_scan");

    try {
      const { qrRaw, imageBase64, mimeType, thumbnailDataUrl } = await decodeQrImage(file);
      appendChatMessage({
        id: `u-${Date.now()}`,
        role: "user",
        text: "ส่งรูปภาพ QR / สลิป",
        thumbnailUrl: thumbnailDataUrl,
      });

      const tlv = qrRaw ? parsePromptPayPayload(qrRaw) : {};
      let vision: {
        isValidPaymentImage?: boolean;
        type?: TransactionType;
        merchant?: string;
        sender?: string;
        receiver?: string;
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
            userName: user.name,
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

      const matchingCategories = categories.filter(
        (c) => c.type === txType && c.id !== "recurring"
      );
      const validCategory =
        vision?.categoryId && matchingCategories.some((c) => c.id === vision?.categoryId)
          ? vision.categoryId
          : guessCategoryId(merchant, txType);

      setPendingQrDraft({
        thumbnailUrl: thumbnailDataUrl,
        type: txType,
        merchant,
        ...(vision?.sender ? { sender: vision.sender } : {}),
        ...(vision?.receiver ? { receiver: vision.receiver } : {}),
        promptPayId,
        amount: amount > 0 ? String(amount) : "",
        categoryId: validCategory,
        needsAmount: !(amount > 0),
      });
    } catch {
      appendChatMessage({
        id: `e-${Date.now()}`,
        role: "error",
        text: "ไม่สามารถอ่านไฟล์รูปภาพนี้ได้ กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setLoading(false);
      setLoadingStage(null);
    }
  };

  const handleConfirmQrDraft = async () => {
    if (!pendingQrDraft || loading) return;
    const merchant = pendingQrDraft.merchant.trim();
    const rawAmount = Number(pendingQrDraft.amount);
    if (!merchant || !Number.isFinite(rawAmount) || rawAmount <= 0) {
      setPendingQrDraft((prev) =>
        prev ? { ...prev, error: "กรุณากรอกชื่อรายการและจำนวนเงินที่มากกว่า 0" } : prev
      );
      return;
    }

    const draft = pendingQrDraft;
    setLoading(true);
    setLoadingStage("saving");
    const saveRes = await addTransaction({
      title: merchant,
      amount: rawAmount,
      type: draft.type,
      categoryId: draft.categoryId,
      channel: "สแกน QR / สลิป (AI Chat)",
      date: new Date().toISOString(),
    });
    setLoading(false);
    setLoadingStage(null);

    if (!saveRes.ok) {
      setPendingQrDraft((prev) =>
        prev ? { ...prev, error: saveRes.error || "ไม่สามารถบันทึกรายการได้" } : prev
      );
      return;
    }

    const catName =
      categories.find((c) => c.id === draft.categoryId)?.name || draft.categoryId;
    setPendingQrDraft(null);
    appendChatMessage({
      id: `a-${Date.now()}`,
      role: "assistant",
      text: `บันทึกรายการจาก QR / สลิป **${merchant}** (${catName}) ยอด **${formatTHB(rawAmount)}** เรียบร้อยแล้วค่ะ`,
      txAction: {
        status: "saved",
        transactionId: saveRes.transactionId,
        type: draft.type,
        merchant,
        ...(draft.sender ? { sender: draft.sender } : {}),
        ...(draft.receiver ? { receiver: draft.receiver } : {}),
        promptPayId: draft.promptPayId,
        amount: rawAmount,
        categoryId: draft.categoryId,
      },
    });
  };

  const handleCancelQrDraft = () => {
    if (!pendingQrDraft || loading) return;
    const draft = pendingQrDraft;
    setPendingQrDraft(null);
    appendChatMessage({
      id: `a-${Date.now()}`,
      role: "assistant",
      text: "ยกเลิกรายการสแกน QR / สลิปนี้แล้วค่ะ",
      txAction: {
        status: "cancelled",
        type: draft.type,
        merchant: draft.merchant.trim() || "รายการสแกน QR",
        ...(draft.sender ? { sender: draft.sender } : {}),
        ...(draft.receiver ? { receiver: draft.receiver } : {}),
        promptPayId: draft.promptPayId,
        amount: Number(draft.amount) || 0,
        categoryId: draft.categoryId,
      },
    });
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
    if (inputLocked) return;
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
            onClick={() => {
              setPendingQrDraft(null);
              clearChatMessages();
            }}
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
            disabled={inputLocked}
            onClick={() => sendPrompt(s)}
            className="text-xs px-3 py-1.5 rounded-full bg-surface-container border border-outline-variant/40 text-on-surface-variant hover:text-on-surface hover:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

                      {action.status === "cancelled" && (
                        <div className="text-on-surface-variant italic">
                          ยกเลิกรายการสแกน QR / สลิป ({action.merchant}) แล้ว
                        </div>
                      )}

                      {(action.status === "pending" || action.status === "needs_amount") && (() => {
                        const amountVal =
                          pendingAmounts[m.id] ?? (action.amount > 0 ? String(action.amount) : "");
                        const canSwapParties = Boolean(
                          action.sender && action.receiver && action.sender !== action.receiver
                        );
                        return (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2 text-on-surface-variant">
                              <div className="flex items-center gap-1.5">
                                <span>รายการ / ร้านค้า:</span>
                                {canSwapParties && (
                                  <button
                                    type="button"
                                    title={`ผู้โอน: ${action.sender} | ผู้รับ: ${action.receiver}`}
                                    onClick={() => {
                                      const nextMerchant =
                                        action.merchant === action.receiver
                                          ? action.sender!
                                          : action.receiver!;
                                      updateChatMessage(m.id, {
                                        txAction: { ...action, merchant: nextMerchant },
                                      });
                                    }}
                                    className="px-1.5 py-0.5 rounded border border-outline-variant/50 bg-surface-container-low text-[11px] font-medium text-primary hover:bg-surface-container-high"
                                  >
                                    ผู้โอน ⇄ ผู้รับ
                                  </button>
                                )}
                              </div>
                              <input
                                type="text"
                                value={action.merchant}
                                onChange={(e) =>
                                  updateChatMessage(m.id, {
                                    txAction: { ...action, merchant: e.target.value },
                                  })
                                }
                                className="bg-surface-container border border-outline-variant/40 rounded px-2 py-1 text-xs font-semibold text-on-surface text-right w-48 focus:outline-none focus:border-primary"
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-on-surface-variant">ประเภท &amp; หมวดหมู่:</span>
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={action.type}
                                  onChange={(e) => {
                                    const nextType = e.target.value as TransactionType;
                                    const firstCat =
                                      categories.find((c) => c.type === nextType && c.id !== "recurring")
                                        ?.id || "food";
                                    const nextMerchant =
                                      canSwapParties &&
                                      (action.merchant === action.sender ||
                                        action.merchant === action.receiver)
                                        ? nextType === "income"
                                          ? action.sender!
                                          : action.receiver!
                                        : action.merchant;
                                    updateChatMessage(m.id, {
                                      txAction: {
                                        ...action,
                                        type: nextType,
                                        categoryId: firstCat,
                                        merchant: nextMerchant,
                                      },
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
                                    .filter((c) => c.type === action.type && c.id !== "recurring")
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
                                value={amountVal}
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
                                disabled={loading || !(Number(amountVal) > 0)}
                                onClick={() => handleConfirmPendingTx(m)}
                                className="px-3.5 py-1.5 rounded-lg bg-primary-container text-on-primary-container text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                              >
                                ยืนยันบันทึก
                              </button>
                              <button
                                type="button"
                                disabled={loading}
                                onClick={() =>
                                  updateChatMessage(m.id, {
                                    txAction: { ...action, status: "cancelled" },
                                  })
                                }
                                className="px-3 py-1.5 rounded-lg border border-outline-variant/40 text-on-surface-variant hover:text-on-surface text-xs"
                              >
                                ยกเลิก
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  {/* Write Tool Confirmation Block (Flattened with border divider) */}
                  {m.pendingTool && (
                    <div className="mt-3 pt-3 border-t border-outline-variant/30 text-xs space-y-2.5">
                      <div className="font-semibold text-on-surface">{m.pendingTool.summary}</div>
                      {m.pendingTool.status === "pending" && (() => {
                        const pt = m.pendingTool;
                        const updateToolArgs = (nextArgs: Record<string, unknown>) => {
                          updateChatMessage(m.id, {
                            pendingTool: {
                              ...pt,
                              args: nextArgs,
                              summary: describeWriteTool(pt.name, nextArgs, {
                                bankBalance,
                                transactions,
                                categories,
                                recurring,
                                autoDebitOnExpense: settings.autoDebitOnExpense,
                              }),
                            },
                          });
                        };

                        return (
                          <div className="space-y-2">
                            {pt.name === "add_transaction" && (
                              <div className="flex flex-wrap items-center gap-2">
                                <select
                                  aria-label="เลือกหมวดหมู่"
                                  value={String(pt.args.categoryId || "")}
                                  onChange={(e) =>
                                    updateToolArgs({ ...pt.args, categoryId: e.target.value })
                                  }
                                  className="bg-surface-container border border-outline-variant/40 rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                                >
                                  {categories
                                    .filter(
                                      (c) =>
                                        c.id !== "recurring" &&
                                        c.type === (pt.args.type === "income" ? "income" : "expense")
                                    )
                                    .map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.name}
                                      </option>
                                    ))}
                                </select>
                                <select
                                  aria-label="ช่องทางการชำระเงิน"
                                  value={String(pt.args.channel || "Virtual Bank Wallet")}
                                  onChange={(e) =>
                                    updateToolArgs({ ...pt.args, channel: e.target.value })
                                  }
                                  className="bg-surface-container border border-outline-variant/40 rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                                >
                                  <option value="Virtual Bank Wallet">Virtual Bank Wallet</option>
                                  <option value="สแกน PromptPay QR">สแกน PromptPay QR</option>
                                  <option value="Virtual Card">Virtual Card</option>
                                  <option value="เงินสด">เงินสด</option>
                                </select>
                                <input
                                  type="number"
                                  min="1"
                                  step="0.01"
                                  aria-label="จำนวนเงิน"
                                  value={pt.args.amount === "" ? "" : Number(pt.args.amount ?? 0)}
                                  onChange={(e) =>
                                    updateToolArgs({
                                      ...pt.args,
                                      amount: e.target.value === "" ? "" : Number(e.target.value),
                                    })
                                  }
                                  className="w-28 bg-surface-container border border-outline-variant/40 rounded-lg px-2.5 py-1.5 text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
                                />
                              </div>
                            )}

                            {pt.name === "update_category_budget" && (
                              <div className="flex flex-wrap items-center gap-2">
                                <select
                                  aria-label="เลือกหมวดหมู่รายจ่าย"
                                  value={String(pt.args.categoryId || "")}
                                  onChange={(e) =>
                                    updateToolArgs({ ...pt.args, categoryId: e.target.value })
                                  }
                                  className="bg-surface-container border border-outline-variant/40 rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                                >
                                  {categories
                                    .filter((c) => c.type === "expense" && c.id !== "recurring")
                                    .map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.name}
                                      </option>
                                    ))}
                                </select>
                                <input
                                  type="number"
                                  min="0"
                                  step="100"
                                  aria-label="งบประมาณต่อเดือน"
                                  value={pt.args.budget === "" ? "" : Number(pt.args.budget ?? 0)}
                                  onChange={(e) =>
                                    updateToolArgs({
                                      ...pt.args,
                                      budget: e.target.value === "" ? "" : Number(e.target.value),
                                    })
                                  }
                                  className="w-32 bg-surface-container border border-outline-variant/40 rounded-lg px-2.5 py-1.5 text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
                                />
                              </div>
                            )}

                            {pt.name === "virtual_bank_transfer" && (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-on-surface-variant">จำนวนเงิน:</span>
                                <input
                                  type="number"
                                  min="1"
                                  step="0.01"
                                  aria-label="จำนวนเงินโอน"
                                  value={pt.args.amount === "" ? "" : Number(pt.args.amount ?? 0)}
                                  onChange={(e) =>
                                    updateToolArgs({
                                      ...pt.args,
                                      amount: e.target.value === "" ? "" : Number(e.target.value),
                                    })
                                  }
                                  className="w-32 bg-surface-container border border-outline-variant/40 rounded-lg px-2.5 py-1.5 text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
                                />
                              </div>
                            )}

                            {pt.name === "add_recurring_payment" && (
                              <div className="flex flex-wrap items-center gap-2">
                                <select
                                  aria-label="ประเภทรายการประจำ"
                                  value={pt.args.type === "income" ? "income" : "expense"}
                                  onChange={(e) => {
                                    const nextType = e.target.value === "income" ? "income" : "expense";
                                    updateToolArgs({
                                      ...pt.args,
                                      type: nextType,
                                      categoryId: nextType === "income" ? "salary" : "recurring",
                                      icon: nextType === "income" ? "payments" : "autorenew",
                                    });
                                  }}
                                  className="bg-surface-container border border-outline-variant/40 rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                                >
                                  <option value="expense">รายจ่ายประจำ</option>
                                  <option value="income">รายรับประจำ</option>
                                </select>
                                {pt.args.type === "income" && (
                                  <select
                                    aria-label="หมวดหมู่รายรับประจำ"
                                    value={String(pt.args.categoryId || "salary")}
                                    onChange={(e) =>
                                      updateToolArgs({ ...pt.args, categoryId: e.target.value })
                                    }
                                    className="bg-surface-container border border-outline-variant/40 rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                                  >
                                    {categories
                                      .filter((c) => c.type === "income")
                                      .map((c) => (
                                        <option key={c.id} value={c.id}>
                                          {c.name}
                                        </option>
                                      ))}
                                  </select>
                                )}
                                <select
                                  aria-label="รอบการตัดเงิน"
                                  value={String(pt.args.cycle || "monthly")}
                                  onChange={(e) =>
                                    updateToolArgs({ ...pt.args, cycle: e.target.value })
                                  }
                                  className="bg-surface-container border border-outline-variant/40 rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                                >
                                  <option value="monthly">รายเดือน</option>
                                  <option value="weekly">รายสัปดาห์</option>
                                  <option value="yearly">รายปี</option>
                                </select>
                                <input
                                  type="date"
                                  aria-label="วันครบกำหนดถัดไป"
                                  value={String(pt.args.nextDueDate || "")}
                                  onChange={(e) =>
                                    updateToolArgs({ ...pt.args, nextDueDate: e.target.value })
                                  }
                                  className="bg-surface-container border border-outline-variant/40 rounded-lg px-2.5 py-1.5 text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
                                />
                                <input
                                  type="number"
                                  min="1"
                                  step="0.01"
                                  aria-label="จำนวนเงินต่อรอบ"
                                  value={pt.args.amount === "" ? "" : Number(pt.args.amount ?? 0)}
                                  onChange={(e) =>
                                    updateToolArgs({
                                      ...pt.args,
                                      amount:
                                        e.target.value === "" ? "" : Number(e.target.value),
                                    })
                                  }
                                  className="w-28 bg-surface-container border border-outline-variant/40 rounded-lg px-2.5 py-1.5 text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
                                />
                              </div>
                            )}

                            <div className="flex items-center gap-2 pt-0.5">
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
                          </div>
                        );
                      })()}
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
            <div className="inline-flex items-center gap-2 text-xs text-on-surface-variant font-mono">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span>
                {loadingStage === "qr_scan"
                  ? "กำลังสแกน QR / OCR และวิเคราะห์ด้วย Finora AI..."
                  : loadingStage === "saving"
                  ? "กำลังบันทึกรายการ..."
                  : "กำลังประมวลผลด้วย Finora AI..."}
              </span>
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
              inputLocked ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <span className="material-symbols-outlined text-[18px] text-primary">
              qr_code_scanner
            </span>
            <span className="hidden sm:inline">ส่ง QR / สลิป</span>
            <input
              type="file"
              accept="image/*"
              disabled={inputLocked}
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
            disabled={inputLocked}
            onPaste={handlePaste}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              hasPendingConfirmation
                ? "กรุณากดยืนยันหรือยกเลิกรายการก่อนส่งข้อความต่อ..."
                : "พิมพ์คำถาม หรือวางรูป QR/สลิป (Ctrl+V)..."
            }
            className="flex-1 bg-surface-container-low border border-outline-variant/40 rounded-lg px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={inputLocked || !input.trim()}
            className="px-5 py-2.5 rounded-lg bg-primary-container text-on-primary-container text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            ส่ง
          </button>
        </form>
      </div>

      {/* Blocking QR / Slip Confirmation Modal */}
      {pendingQrDraft && (() => {
        const canSwapParties = Boolean(
          pendingQrDraft.sender &&
            pendingQrDraft.receiver &&
            pendingQrDraft.sender !== pendingQrDraft.receiver
        );
        const modalCats = categories.filter(
          (c) => c.type === pendingQrDraft.type && c.id !== "recurring"
        );
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-backdrop-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-confirm-modal-title"
          >
            <div className="w-full max-w-lg rounded-xl bg-surface-container border border-outline-variant/40 shadow-2xl overflow-hidden animate-modal-in">
              <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-outline-variant/30">
                <div className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-primary text-[22px] mt-0.5">
                    qr_code_scanner
                  </span>
                  <div>
                    <h2
                      id="qr-confirm-modal-title"
                      className="text-lg font-semibold text-on-surface m-0"
                    >
                      ตรวจสอบข้อมูลจาก QR / สลิป
                    </h2>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      กรุณาตรวจสอบและกดยืนยันหรือยกเลิกก่อนส่งข้อความหรือสแกนรายการถัดไป
                    </p>
                  </div>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleConfirmQrDraft();
                }}
                className="p-6 space-y-4"
              >
                <div className="flex items-center gap-3.5 p-3 rounded-lg bg-surface-container-low border border-outline-variant/30">
                  <img
                    src={pendingQrDraft.thumbnailUrl}
                    alt="QR or Slip Preview"
                    className="h-16 w-16 object-contain rounded-md bg-white p-1 border border-outline-variant/30 shrink-0"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-on-surface truncate">
                        {pendingQrDraft.merchant || "รายการสแกน QR"}
                      </span>
                      {pendingQrDraft.needsAmount && (
                        <span className="px-2 py-0.5 rounded-full bg-secondary/15 text-secondary text-[10px] font-semibold">
                          ต้องกรอกยอดเงิน
                        </span>
                      )}
                    </div>
                    {pendingQrDraft.promptPayId && pendingQrDraft.promptPayId !== "-" && (
                      <div className="text-[11px] font-mono text-on-surface-variant truncate">
                        PromptPay / Ref: {pendingQrDraft.promptPayId}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-surface-container-low">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      const firstCat =
                        categories.find((c) => c.type === "expense" && c.id !== "recurring")
                          ?.id || "food";
                      setPendingQrDraft((prev) => {
                        if (!prev) return prev;
                        const nextMerchant =
                          canSwapParties &&
                          (prev.merchant === prev.sender || prev.merchant === prev.receiver)
                            ? prev.receiver!
                            : prev.merchant;
                        return {
                          ...prev,
                          type: "expense",
                          categoryId: firstCat,
                          merchant: nextMerchant,
                          error: undefined,
                        };
                      });
                    }}
                    className={`py-2 rounded-md text-sm font-semibold transition-colors ${
                      pendingQrDraft.type === "expense"
                        ? "bg-secondary text-on-secondary shadow-sm"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    รายจ่าย
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      const firstCat =
                        categories.find((c) => c.type === "income" && c.id !== "recurring")
                          ?.id || "salary";
                      setPendingQrDraft((prev) => {
                        if (!prev) return prev;
                        const nextMerchant =
                          canSwapParties &&
                          (prev.merchant === prev.sender || prev.merchant === prev.receiver)
                            ? prev.sender!
                            : prev.merchant;
                        return {
                          ...prev,
                          type: "income",
                          categoryId: firstCat,
                          merchant: nextMerchant,
                          error: undefined,
                        };
                      });
                    }}
                    className={`py-2 rounded-md text-sm font-semibold transition-colors ${
                      pendingQrDraft.type === "income"
                        ? "bg-primary-container text-on-primary-container shadow-sm"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    รายรับ
                  </button>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="qr-modal-merchant"
                      className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider"
                    >
                      รายการ / ร้านค้า
                    </label>
                    {canSwapParties && (
                      <button
                        type="button"
                        disabled={loading}
                        title={`ผู้โอน: ${pendingQrDraft.sender} | ผู้รับ: ${pendingQrDraft.receiver}`}
                        onClick={() =>
                          setPendingQrDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  merchant:
                                    prev.merchant === prev.receiver
                                      ? prev.sender!
                                      : prev.receiver!,
                                }
                              : prev
                          )
                        }
                        className="px-2 py-0.5 rounded border border-outline-variant/50 bg-surface-container-low text-[11px] font-medium text-primary hover:bg-surface-container-high"
                      >
                        ผู้โอน ⇄ ผู้รับ
                      </button>
                    )}
                  </div>
                  <input
                    id="qr-modal-merchant"
                    type="text"
                    disabled={loading}
                    value={pendingQrDraft.merchant}
                    onChange={(e) =>
                      setPendingQrDraft((prev) =>
                        prev ? { ...prev, merchant: e.target.value, error: undefined } : prev
                      )
                    }
                    className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="qr-modal-category"
                      className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5"
                    >
                      หมวดหมู่
                    </label>
                    <select
                      id="qr-modal-category"
                      disabled={loading}
                      value={pendingQrDraft.categoryId}
                      onChange={(e) =>
                        setPendingQrDraft((prev) =>
                          prev ? { ...prev, categoryId: e.target.value } : prev
                        )
                      }
                      className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary"
                    >
                      {modalCats.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="qr-modal-amount"
                      className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5"
                    >
                      จำนวนเงิน (THB)
                    </label>
                    <input
                      id="qr-modal-amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      autoFocus={pendingQrDraft.needsAmount}
                      disabled={loading}
                      placeholder="0.00"
                      value={pendingQrDraft.amount}
                      onChange={(e) =>
                        setPendingQrDraft((prev) =>
                          prev ? { ...prev, amount: e.target.value, error: undefined } : prev
                        )
                      }
                      className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2.5 text-sm font-mono text-on-surface focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {pendingQrDraft.error && (
                  <p className="text-xs text-error font-medium">{pendingQrDraft.error}</p>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleCancelQrDraft}
                    className="px-4 py-2 rounded-lg text-sm font-medium border border-outline-variant/40 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high disabled:opacity-50"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !(Number(pendingQrDraft.amount) > 0)}
                    className="px-5 py-2 rounded-lg text-sm font-semibold bg-primary-container text-on-primary-container hover:opacity-90 disabled:opacity-50 shadow-sm"
                  >
                    {loading ? "กำลังบันทึก..." : "ยืนยันบันทึก"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
