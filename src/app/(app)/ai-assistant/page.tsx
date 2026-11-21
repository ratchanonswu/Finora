"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useFinora } from "@/context/FinoraContext";
import {
  formatTHB,
  formatThaiDate,
  isInCurrentQuotaCycle,
  nextCategoryColor,
  normalizeTransactionDate,
  todayYmd,
  ymdToIso,
} from "@/lib/seed";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { IconColorPicker } from "@/components/IconColorPicker";
import { prepareSlipImage } from "@/lib/slip-image";
import { useDialogAccessibility } from "@/lib/useDialogAccessibility";
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

const CHAT_SCROLL_DURATION_MS = 625;
const SCROLL_BOTTOM_THRESHOLD_PX = 48;
const MAX_TEXTAREA_HEIGHT_PX = 144;

interface ScrollAnimationState {
  rafId: number;
  startTime: number;
  duration: number;
  startTop: number;
  targetTop: number;
  initialSlope: number;
  lastTop: number;
  velocityPxPerMs: number;
}

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
      } else if (/^(?:[-*_]\s*){3,}$/.test(trimmed)) {
        elements.push(<hr key={i} className="my-3 border-t border-outline-variant/30" />);
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
    )
  });
}

interface PendingTxItem {
  id: string;
  type: TransactionType;
  merchant: string;
  sender?: string;
  receiver?: string;
  promptPayId?: string;
  amount: string;
  categoryId: string;
  channel: string;
  date: string; // YYYY-MM-DD
  needsAmount?: boolean;
}

interface PendingCategoryItem {
  id: string;
  name: string;
  type: TransactionType;
  budget: string;
  icon: string;
  color: string;
}

interface PendingTxDraft {
  source: "slip" | "chat_tool";
  thumbnailUrl?: string;
  newCategories?: PendingCategoryItem[];
  items: PendingTxItem[];
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
    addCategory,
    addRecurring,
  } = useFinora();

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<"chat" | "slip_scan" | "saving" | null>(null);
  const [pendingAmounts, setPendingAmounts] = useState<Record<string, string>>({});
  const [pendingTxDraft, setPendingTxDraft] = useState<PendingTxDraft | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const pendingDraftDialogRef = useRef<HTMLDivElement | null>(null);
  const scrollAnimRef = useRef<ScrollAnimationState | null>(null);
  const userCancelledScrollRef = useRef(false);
  const hasMountedScrollRef = useRef(false);
  const activeUserMediaIdRef = useRef<string | null>(null);
  const prevChatMetaRef = useRef<{
    count: number;
    lastId: string | null;
    loadingStage: "chat" | "slip_scan" | "saving" | null;
  }>({
    count: chatMessages.length,
    lastId: chatMessages[chatMessages.length - 1]?.id ?? null,
    loadingStage,
  });

  const syncScrollToBottomButton = useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
    const shouldShow = distanceFromBottom > SCROLL_BOTTOM_THRESHOLD_PX;
    setShowScrollToBottom((prev) => (prev === shouldShow ? prev : shouldShow));
  }, []);

  const stopChatScrollAnimation = useCallback(() => {
    if (scrollAnimRef.current !== null) {
      window.cancelAnimationFrame(scrollAnimRef.current.rafId);
      scrollAnimRef.current = null;
    }
  }, []);

  // Use rAF with Hermite interpolation so scroll smoothly re-anchors if slip media or replies change height mid-scroll.
  const animateChatScrollToBottom = useCallback(
    (reason: "user_action" | "new_message" | "media_load") => {
      const el = chatScrollRef.current;
      if (!el) return;

      const targetTop = Math.max(0, el.scrollHeight - el.clientHeight);
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        stopChatScrollAnimation();
        el.scrollTop = targetTop;
        syncScrollToBottomButton();
        return;
      }

      const now = performance.now();
      const active = scrollAnimRef.current;

      if (active) {
        if (Math.abs(targetTop - active.targetTop) <= 1) return;

        const currentTop = Math.min(active.lastTop, targetTop);
        const delta = targetTop - currentTop;
        if (delta <= 1) {
          stopChatScrollAnimation();
          el.scrollTop = targetTop;
          syncScrollToBottomButton();
          return;
        }

        const elapsed = Math.max(0, now - active.startTime);
        const remaining = Math.max(0, active.duration - elapsed);
        let nextDuration: number;
        if (reason === "media_load") {
          nextDuration = Math.max(remaining, 300);
        } else if (elapsed < 400) {
          nextDuration = Math.max(remaining, CHAT_SCROLL_DURATION_MS - elapsed);
        } else {
          nextDuration = CHAT_SCROLL_DURATION_MS;
        }

        const initialSlope = Math.max(
          0,
          Math.min(active.velocityPxPerMs * nextDuration, 2 * delta)
        );

        active.startTime = now;
        active.duration = nextDuration;
        active.startTop = currentTop;
        active.targetTop = targetTop;
        active.initialSlope = initialSlope;
        active.lastTop = currentTop;
        return;
      }

      const startTop = el.scrollTop;
      const delta = targetTop - startTop;
      if (delta <= 1) {
        el.scrollTop = targetTop;
        syncScrollToBottomButton();
        return;
      }

      const state: ScrollAnimationState = {
        rafId: 0,
        startTime: now,
        duration: CHAT_SCROLL_DURATION_MS,
        startTop,
        targetTop,
        initialSlope: 0,
        lastTop: startTop,
        velocityPxPerMs: 0,
      };

      const step = (frameTime: number) => {
        const container = chatScrollRef.current;
        const current = scrollAnimRef.current;
        if (!container || current !== state) return;

        const liveMaxTop = Math.max(0, container.scrollHeight - container.clientHeight);
        const elapsed = Math.max(0, frameTime - current.startTime);
        const p = current.duration > 0 ? Math.min(1, elapsed / current.duration) : 1;

        if (p >= 1 || liveMaxTop <= current.startTop) {
          container.scrollTop = liveMaxTop;
          scrollAnimRef.current = null;
          syncScrollToBottomButton();
          return;
        }

        const totalDelta = current.targetTop - current.startTop;
        const safeSlope = Math.min(current.initialSlope, 2 * totalDelta);
        const p2 = p * p;
        const p3 = p2 * p;
        const nextTop =
          current.startTop +
          totalDelta * (3 * p2 - 2 * p3) +
          safeSlope * (p3 - 2 * p2 + p);

        if (liveMaxTop < current.targetTop && nextTop >= liveMaxTop) {
          container.scrollTop = liveMaxTop;
          scrollAnimRef.current = null;
          syncScrollToBottomButton();
          return;
        }

        const dydp =
          6 * totalDelta * p * (1 - p) +
          safeSlope * (3 * p2 - 4 * p + 1);

        current.lastTop = nextTop;
        current.velocityPxPerMs = current.duration > 0 ? dydp / current.duration : 0;
        container.scrollTop = Math.min(nextTop, liveMaxTop);

        current.rafId = window.requestAnimationFrame(step);
      };

      scrollAnimRef.current = state;
      state.rafId = window.requestAnimationFrame(step);
    },
    [stopChatScrollAnimation, syncScrollToBottomButton]
  );

  const handleManualScrollInterrupt = useCallback(() => {
    if (scrollAnimRef.current !== null) {
      userCancelledScrollRef.current = true;
      stopChatScrollAnimation();
    }
  }, [stopChatScrollAnimation]);

  useEffect(() => {
    return () => {
      stopChatScrollAnimation();
    };
  }, [stopChatScrollAnimation]);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      syncScrollToBottomButton();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [syncScrollToBottomButton]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT_PX ? "auto" : "hidden";
  }, [input]);

  useEffect(() => {
    const el = chatScrollRef.current;
    const lastMsg = chatMessages[chatMessages.length - 1] ?? null;
    const prev = prevChatMetaRef.current;

    if (!hasMountedScrollRef.current) {
      hasMountedScrollRef.current = true;
      prevChatMetaRef.current = {
        count: chatMessages.length,
        lastId: lastMsg?.id ?? null,
        loadingStage,
      };
      if (el && chatMessages.length > 1) {
        el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
      }
      syncScrollToBottomButton();
      return;
    }

    const isResetToWelcome =
      chatMessages.length === 1 &&
      lastMsg?.id === "welcome" &&
      prev.count > 1;

    if (isResetToWelcome) {
      stopChatScrollAnimation();
      userCancelledScrollRef.current = false;
      activeUserMediaIdRef.current = null;
      if (el) el.scrollTop = 0;
      prevChatMetaRef.current = {
        count: chatMessages.length,
        lastId: lastMsg?.id ?? null,
        loadingStage,
      };
      syncScrollToBottomButton();
      return;
    }

    const hasNewMessage =
      chatMessages.length > prev.count && Boolean(lastMsg && lastMsg.id !== prev.lastId);
    const startedSlipAttach =
      loadingStage === "slip_scan" && prev.loadingStage !== "slip_scan";

    prevChatMetaRef.current = {
      count: chatMessages.length,
      lastId: lastMsg?.id ?? null,
      loadingStage,
    };

    if (hasNewMessage && lastMsg?.role === "user") {
      userCancelledScrollRef.current = false;
      if (lastMsg.thumbnailUrl) {
        activeUserMediaIdRef.current = lastMsg.id;
      }
      animateChatScrollToBottom("new_message");
    } else if (startedSlipAttach) {
      userCancelledScrollRef.current = false;
      animateChatScrollToBottom("user_action");
    } else if (hasNewMessage && !userCancelledScrollRef.current) {
      animateChatScrollToBottom("new_message");
    }
    syncScrollToBottomButton();
  }, [
    chatMessages,
    loadingStage,
    animateChatScrollToBottom,
    stopChatScrollAnimation,
    syncScrollToBottomButton,
  ]);

  const hasPendingConfirmation = useMemo(
    () =>
      pendingTxDraft !== null ||
      chatMessages.some(
        (m) =>
          m.pendingTool?.status === "pending" ||
          m.txAction?.status === "pending" ||
          m.txAction?.status === "needs_amount"
      ),
    [pendingTxDraft, chatMessages]
  );
  const inputLocked = loading || hasPendingConfirmation;

  const buildFinancialSummary = (cats: Category[]) => {
    const income = transactions
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + t.amount, 0);
    const expense = transactions
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + t.amount, 0);
    const cycleTxs = transactions.filter((t) =>
      isInCurrentQuotaCycle(t.date, settings.quotaResetAt)
    );
    const cycleIncome = cycleTxs
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + t.amount, 0);
    const cycleExpense = cycleTxs
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + t.amount, 0);
    const sumActiveRecurring = (targetType: TransactionType) =>
      recurring
        .filter((r) => r.active && (r.type ?? "expense") === targetType)
        .reduce((s, r) => s + (r.cycle === "yearly" ? r.amount / 12 : r.amount), 0);
    const recExpenseSum = sumActiveRecurring("expense");
    const recIncomeSum = sumActiveRecurring("income");
    const catBreakdown = cats
      .filter((c) => c.type === "expense" && c.id !== "recurring")
      .map((c) => {
        const sum = cycleTxs
          .filter((t) => t.categoryId === c.id && t.type === "expense")
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
        .map((r) => {
          const recTypeLabel = (r.type ?? "expense") === "income" ? "รายรับประจำ" : "รายจ่ายประจำ";
          return `[${r.id}] ${r.title} (${recTypeLabel}, ${formatTHB(r.amount)}, ${r.active ? "เปิด" : "พัก"})`;
        })
        .join(", ") || "ไม่มี";

    return [
      `วันที่ปัจจุบัน: ${todayYmd()} (${new Date().toLocaleDateString("th-TH", { dateStyle: "long" })})`,
      `ยอดเงินคงเหลือ Virtual Wallet: ${formatTHB(bankBalance)}`,
      `รายรับรวมทั้งหมด: ${formatTHB(income)} | รายจ่ายรวมทั้งหมด: ${formatTHB(expense)}`,
      ...(settings.quotaResetAt
        ? [
            `รอบโควต้าปัจจุบัน: รายรับ ${formatTHB(cycleIncome)} | รายจ่าย ${formatTHB(cycleExpense)}`,
          ]
        : []),
      `รายจ่ายประจำ (Recurring ที่เปิดอยู่): ${formatTHB(recExpenseSum)}/เดือน`,
      `รายรับประจำ (Recurring ที่เปิดอยู่): ${formatTHB(recIncomeSum)}/เดือน`,
      `รายการ Recurring: ${recList}`,
      `หมวดรายจ่ายที่มี (ยอดใช้ในรอบปัจจุบัน):\n${catBreakdown}`,
      `หมวดรายรับที่มี: ${incomeCats}`,
    ].join("\n");
  };

  const financialSummary = useMemo(
    () => buildFinancialSummary(categories),
    [bankBalance, transactions, categories, recurring, settings.quotaResetAt]
  );

  const runToolLoop = async (initialHistory: OpenRouterMessage[]) => {
    const history = [...initialHistory];
    const summaryText = financialSummary;
    const snapshot = {
      bankBalance,
      transactions,
      categories,
      recurring,
      autoDebitOnExpense: settings.autoDebitOnExpense,
      quotaResetAt: settings.quotaResetAt,
    };

    let retriedMissingTool = false;

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
        const replyText = String(data.reply || "");
        const looksLikeFakeToolConfirm =
          !retriedMissingTool &&
          /กดยืนยันในการ์ด|การ์ดที่ระบบแสดง|กำลังส่งรายการให้คุณยืนยัน|เตรียมดำเนินการนี้ให้เรียบร้อย|ต้องการให้บันทึกเป็นรายรับ|ต้องการให้บันทึกเป็นรายจ่าย/.test(
            replyText
          );

        if (looksLikeFakeToolConfirm) {
          retriedMissingTool = true;
          history.push({ role: "assistant", content: replyText });
          history.push({
            role: "user",
            content:
              "[ระบบ] คุณยังไม่ได้ส่ง Function Call (tool_calls) จริง ทำให้หน้าต่างหรือการ์ดยืนยันไม่ปรากฏบนหน้าจอ กรุณาเรียกใช้ Tool ที่เกี่ยวข้อง (เช่น add_transaction, update_category_budget, add_category หรือ add_recurring_payment) ทันทีโดยใช้ค่าเริ่มต้นสำหรับฟิลด์ที่ผู้ใช้ไม่ได้ระบุค่ะ",
          });
          continue;
        }

        appendChatMessage({
          id: `a-${Date.now()}`,
          role: "assistant",
          text: replyText,
        });
        return;
      }

      history.push({ role: "assistant", content: data.reply || null, tool_calls: toolCalls });

      const parsedCalls = toolCalls
        .map((tc) => {
          let args: Record<string, unknown> = {};
          let parseError = false;
          const rawArgsText = String(tc.function.arguments || "").trim();
          if (rawArgsText) {
            try {
              const parsed = JSON.parse(rawArgsText);
              if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                parseError = true;
              } else {
                args = parsed as Record<string, unknown>;
              }
            } catch {
              parseError = true;
            }
          }
          return { tc, args, parseError };
        })
        .sort(
          (a, b) =>
            getToolExecutionPriority(a.tc.function.name, a.args) -
            getToolExecutionPriority(b.tc.function.name, b.args)
        );

      const workingCategories: Category[] = [...categories];
      const draftCategories: PendingCategoryItem[] = [];
      const txItems: PendingTxItem[] = [];
      const otherWriteCards: Array<{
        tc: OpenRouterToolCall;
        args: Record<string, unknown>;
        summary: string;
      }> = [];

      for (let idx = 0; idx < parsedCalls.length; idx++) {
        const { tc, args, parseError } = parsedCalls[idx];
        if (parseError) {
          history.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({
              error:
                "รูปแบบ JSON ของ arguments ไม่ถูกต้อง กรุณาเรียกเครื่องมือใหม่อีกครั้งด้วย JSON Object ที่สมบูรณ์",
            }),
          });
          continue;
        }
        const effectiveSnapshot = { ...snapshot, categories: workingCategories };
        if (READ_TOOL_NAMES.has(tc.function.name)) {
          const out = runReadTool(tc.function.name, args, effectiveSnapshot);
          history.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(out) });
        } else if (WRITE_TOOL_NAMES.has(tc.function.name)) {
          const check = validateAndNormalizeWriteTool(tc.function.name, args, effectiveSnapshot);
          if (!check.ok) {
            history.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify({ error: check.error }),
            });
          } else if (tc.function.name === "add_category") {
            const draftId = `draft-cat-${draftCategories.length}`;
            const catType: TransactionType =
              check.args.type === "income" ? "income" : "expense";
            const catBudget = Number(check.args.budget) || 0;
            const catIcon = String(
              check.args.icon || (catType === "income" ? "payments" : "label")
            );
            const catColor = String(
              check.args.color || nextCategoryColor(workingCategories.map((c) => c.color))
            );
            const catName = String(check.args.name || "");
            draftCategories.push({
              id: draftId,
              name: catName,
              type: catType,
              budget: String(catBudget),
              icon: catIcon,
              color: catColor,
            });
            workingCategories.push({
              id: draftId,
              name: catName,
              type: catType,
              budget: catBudget,
              icon: catIcon,
              color: catColor,
            });
          } else if (tc.function.name === "add_transaction") {
            const txType: TransactionType =
              check.args.type === "income" ? "income" : "expense";
            const amt = Number(check.args.amount);
            txItems.push({
              id: tc.id || `tx-draft-${txItems.length}`,
              type: txType,
              merchant: String(check.args.title || "รายการจาก AI"),
              amount: Number.isFinite(amt) && amt > 0 ? String(amt) : "",
              categoryId: String(
                check.args.categoryId || (txType === "income" ? "salary" : "food")
              ),
              channel: String(check.args.channel || "Virtual Bank Wallet"),
              date: String(check.args.date || todayYmd()),
              needsAmount: !(Number.isFinite(amt) && amt > 0),
            });
          } else {
            otherWriteCards.push({
              tc,
              args: check.args,
              summary: check.summary,
            });
          }
        } else {
          history.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({
              error: `ไม่พบเครื่องมือชื่อ "${tc.function.name}" ในระบบ`,
            }),
          });
        }
      }

      for (let i = 0; i < otherWriteCards.length; i++) {
        const card = otherWriteCards[i];
        appendChatMessage({
          id: `t-${Date.now()}-${i}-${card.tc.id}`,
          role: "assistant",
          text: `ฟิโนร่าเตรียมดำเนินการนี้ให้เรียบร้อยแล้วค่ะ กรุณาตรวจสอบและกดยืนยันด้านล่างนะคะ`,
          pendingTool: {
            toolCallId: card.tc.id,
            name: card.tc.function.name,
            args: card.args,
            summary: card.summary,
            status: "pending",
          },
        });
      }

      if (txItems.length > 0) {
        setPendingTxDraft({
          source: "chat_tool",
          ...(draftCategories.length > 0 ? { newCategories: draftCategories } : {}),
          items: txItems,
        });
        return;
      }

      if (draftCategories.length > 0) {
        for (let i = 0; i < draftCategories.length; i++) {
          const dc = draftCategories[i];
          const cardArgs: Record<string, unknown> = {
            name: dc.name,
            type: dc.type,
            budget: Number(dc.budget) || 0,
            icon: dc.icon,
            color: dc.color,
          };
          appendChatMessage({
            id: `t-${Date.now()}-cat-${i}-${dc.id}`,
            role: "assistant",
            text: `ฟิโนร่าเตรียมดำเนินการนี้ให้เรียบร้อยแล้วค่ะ กรุณาตรวจสอบและกดยืนยันด้านล่างนะคะ`,
            pendingTool: {
              toolCallId: dc.id,
              name: "add_category",
              args: cardArgs,
              summary: describeWriteTool("add_category", cardArgs, snapshot),
              status: "pending",
            },
          });
        }
        return;
      }

      if (otherWriteCards.length > 0) return;
    }

    appendChatMessage({
      id: `a-${Date.now()}`,
      role: "assistant",
      text: "ฟิโนร่าประมวลผลหลายขั้นตอนแล้วยังไม่ได้ข้อสรุปสุดท้ายค่ะ กรุณาลองพิมพ์คำสั่งอีกครั้งให้ชัดเจนขึ้นนะคะ",
    });
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
    try {
      const args = check.args;
      if (pt.name === "add_transaction") {
        const res = await addTransaction({
          type: args.type === "income" ? "income" : "expense",
          title: String(args.title || "รายการจาก AI"),
          amount: Number(args.amount) || 0,
          categoryId: String(args.categoryId || (args.type === "income" ? "salary" : "food")),
          channel: String(args.channel || "Virtual Bank Wallet"),
          date: ymdToIso(String(args.date || todayYmd())),
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
      } else if (pt.name === "add_category") {
        addCategory({
          name: String(args.name || ""),
          type: args.type === "income" ? "income" : "expense",
          budget: Number(args.budget) || 0,
          icon: String(args.icon || (args.type === "income" ? "payments" : "label")),
          color: String(args.color || nextCategoryColor(categories.map((c) => c.color))),
        });
        resultText = `สร้างหมวดหมู่สำเร็จ: ${check.summary}`;
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

  const handleSlipFile = async (file: File) => {
    if (inputLocked) return;
    setLoading(true);
    setLoadingStage("slip_scan");

    try {
      const { imageBase64, mimeType, thumbnailDataUrl } = await prepareSlipImage(file);
      appendChatMessage({
        id: `u-${Date.now()}`,
        role: "user",
        text: "ส่งรูปภาพสลิป",
        thumbnailUrl: thumbnailDataUrl,
      });

      let vision: {
        isValidPaymentImage?: boolean;
        type?: TransactionType;
        merchant?: string;
        sender?: string;
        receiver?: string;
        promptPayId?: string;
        amount?: number;
        categoryId?: string;
        date?: string;
      } | null = null;

      let visionError = "";
      try {
        const res = await fetch("/api/ai/slip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64,
            mimeType,
            userName: user.name,
            categories: categories.map((c) => ({ id: c.id, name: c.name, type: c.type })),
            apiKeyOverride: settings.geminiApiKeyOverride,
            autoCategorize: settings.aiAutoCategorize,
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

      if (!vision?.isValidPaymentImage) {
        appendChatMessage({
          id: `e-${Date.now()}`,
          role: "error",
          text: visionError
            ? `ไม่สามารถอ่านรูปภาพด้วย AI ได้ (${visionError})`
            : "ไม่พบข้อมูลสลิปหรือใบเสร็จในรูปภาพนี้ กรุณาอัปโหลดรูปสลิปโอนเงินหรือใบเสร็จที่ชัดเจนนะคะ",
        });
        return;
      }

      const txType: TransactionType = vision?.type === "income" ? "income" : "expense";
      const merchant = vision?.merchant || "รายการจากสลิป";
      const promptPayId = vision?.promptPayId || "-";
      const amount =
        typeof vision?.amount === "number" && vision.amount > 0 ? vision.amount : 0;

      const matchingCategories = categories.filter(
        (c) => c.type === txType && c.id !== "recurring"
      );
      const validCategory = settings.aiAutoCategorize
        ? vision?.categoryId && matchingCategories.some((c) => c.id === vision?.categoryId)
          ? vision.categoryId
          : guessCategoryId(merchant, txType)
        : matchingCategories[0]?.id || (txType === "income" ? "salary" : "food");

      setPendingTxDraft({
        source: "slip",
        thumbnailUrl: thumbnailDataUrl,
        items: [
          {
            id: `slip-${Date.now()}`,
            type: txType,
            merchant,
            ...(vision?.sender ? { sender: vision.sender } : {}),
            ...(vision?.receiver ? { receiver: vision.receiver } : {}),
            promptPayId,
            amount: amount > 0 ? String(amount) : "",
            categoryId: validCategory,
            channel: "สแกนสลิป (AI Chat)",
            date: vision?.date || todayYmd(),
            needsAmount: !(amount > 0),
          },
        ],
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

  const handleConfirmTxDraft = async () => {
    if (!pendingTxDraft || pendingTxDraft.items.length === 0 || loading) return;
    const draft = pendingTxDraft;
    const baseSnapshot = {
      bankBalance,
      transactions,
      categories,
      recurring,
      autoDebitOnExpense: settings.autoDebitOnExpense,
      quotaResetAt: settings.quotaResetAt,
    };

    const workingCategories: Category[] = [...categories];
    const preparedCategories: Array<{
      draftId: string;
      name: string;
      type: TransactionType;
      budget: number;
      icon: string;
      color: string;
      summary: string;
    }> = [];

    for (let i = 0; i < (draft.newCategories?.length ?? 0); i++) {
      const dc = draft.newCategories![i];
      const prefix =
        (draft.newCategories?.length ?? 0) > 1
          ? `หมวดหมู่ใหม่ที่ ${i + 1}: `
          : "หมวดหมู่ใหม่: ";
      const catCheck = validateAndNormalizeWriteTool(
        "add_category",
        {
          name: dc.name,
          type: dc.type,
          budget: dc.type === "income" ? 0 : dc.budget,
          icon: dc.icon,
          color: dc.color,
        },
        { ...baseSnapshot, categories: workingCategories }
      );
      if (!catCheck.ok) {
        setPendingTxDraft((prev) => (prev ? { ...prev, error: `${prefix}${catCheck.error}` } : prev));
        return;
      }
      const normType: TransactionType = catCheck.args.type === "income" ? "income" : "expense";
      const normName = String(catCheck.args.name || "");
      const normBudget = Number(catCheck.args.budget) || 0;
      const normIcon = String(
        catCheck.args.icon || (normType === "income" ? "payments" : "label")
      );
      const normColor = String(
        catCheck.args.color || nextCategoryColor(workingCategories.map((c) => c.color))
      );
      preparedCategories.push({
        draftId: dc.id,
        name: normName,
        type: normType,
        budget: normBudget,
        icon: normIcon,
        color: normColor,
        summary: catCheck.summary,
      });
      workingCategories.push({
        id: dc.id,
        name: normName,
        type: normType,
        budget: normBudget,
        icon: normIcon,
        color: normColor,
      });
    }

    const effectiveSnapshot = { ...baseSnapshot, categories: workingCategories };
    const prepared: Array<{
      item: PendingTxItem;
      merchant: string;
      amount: number;
      categoryId: string;
      channel: string;
      date: string;
    }> = [];

    for (let i = 0; i < draft.items.length; i++) {
      const item = draft.items[i];
      const prefix = draft.items.length > 1 ? `รายการที่ ${i + 1}: ` : "";
      const merchant = item.merchant.trim();
      const rawAmount = Number(item.amount);
      if (!merchant || !Number.isFinite(rawAmount) || rawAmount <= 0) {
        setPendingTxDraft((prev) =>
          prev ? { ...prev, error: `${prefix}กรุณากรอกชื่อรายการและจำนวนเงินที่มากกว่า 0` } : prev
        );
        return;
      }

      const normalizedDate = normalizeTransactionDate(item.date);
      if (!normalizedDate) {
        setPendingTxDraft((prev) =>
          prev ? { ...prev, error: `${prefix}กรุณาเลือกวันที่ที่ถูกต้อง` } : prev
        );
        return;
      }

      let resolvedCategoryId = item.categoryId;
      let resolvedChannel = item.channel;
      let resolvedDate = normalizedDate;

      if (draft.source === "chat_tool") {
        const check = validateAndNormalizeWriteTool(
          "add_transaction",
          {
            type: item.type,
            title: merchant,
            amount: rawAmount,
            categoryId: item.categoryId,
            channel: item.channel,
            date: normalizedDate,
          },
          effectiveSnapshot
        );
        if (!check.ok) {
          setPendingTxDraft((prev) => (prev ? { ...prev, error: `${prefix}${check.error}` } : prev));
          return;
        }
        resolvedCategoryId = String(check.args.categoryId || item.categoryId);
        resolvedChannel = String(check.args.channel || item.channel);
        resolvedDate = String(check.args.date || normalizedDate);
      }

      prepared.push({
        item,
        merchant,
        amount: rawAmount,
        categoryId: resolvedCategoryId,
        channel: resolvedChannel,
        date: resolvedDate,
      });
    }

    setLoading(true);
    setLoadingStage("saving");
    const baseTs = Date.now();
    const savedMessages: ChatMessage[] = [];
    const draftIdMap = new Map<string, string>();
    const createdCategories: Category[] = [];

    for (let i = 0; i < preparedCategories.length; i++) {
      const pc = preparedCategories[i];
      const created = addCategory({
        name: pc.name,
        type: pc.type,
        budget: pc.budget,
        icon: pc.icon,
        color: pc.color,
      });
      draftIdMap.set(pc.draftId, created.id);
      createdCategories.push(created);
      savedMessages.push({
        id: `a-cat-${baseTs}-${i}`,
        role: "assistant",
        text: `สร้างหมวดหมู่สำเร็จ: ${pc.summary} เรียบร้อยแล้วค่ะ`,
      });
    }

    const allKnownCategories = [...categories, ...createdCategories];
    let failedAtIndex = -1;
    let failureError = "";

    for (let i = 0; i < prepared.length; i++) {
      const p = prepared[i];
      const finalCategoryId = draftIdMap.get(p.categoryId) ?? p.categoryId;
      const saveRes = await addTransaction({
        title: p.merchant,
        amount: p.amount,
        type: p.item.type,
        categoryId: finalCategoryId,
        channel: p.channel,
        date: ymdToIso(p.date),
      });

      if (!saveRes.ok) {
        failedAtIndex = i;
        failureError = saveRes.error || "ไม่สามารถบันทึกรายการได้";
        break;
      }

      const catName =
        allKnownCategories.find((c) => c.id === finalCategoryId)?.name || finalCategoryId;
      const confirmText =
        draft.source === "slip"
          ? `บันทึกรายการจากสลิป **${p.merchant}** (${catName}) ยอด **${formatTHB(p.amount)}** วันที่ ${formatThaiDate(p.date)} เรียบร้อยแล้วค่ะ`
          : `บันทึกรายการ **${p.merchant}** (${catName}) ยอด **${formatTHB(p.amount)}** วันที่ ${formatThaiDate(p.date)} เรียบร้อยแล้วค่ะ`;

      savedMessages.push({
        id: `a-${baseTs}-${i}`,
        role: "assistant",
        text: confirmText,
        txAction: {
          status: "saved",
          transactionId: saveRes.transactionId,
          type: p.item.type,
          merchant: p.merchant,
          ...(p.item.sender ? { sender: p.item.sender } : {}),
          ...(p.item.receiver ? { receiver: p.item.receiver } : {}),
          promptPayId: p.item.promptPayId || "-",
          amount: p.amount,
          categoryId: finalCategoryId,
          date: p.date,
        },
      });
    }

    setLoading(false);
    setLoadingStage(null);

    for (const msg of savedMessages) {
      appendChatMessage(msg);
    }

    if (failedAtIndex >= 0) {
      setPendingTxDraft((prev) =>
        prev
          ? {
              ...prev,
              newCategories: undefined,
              items: prev.items.slice(failedAtIndex).map((it) => ({
                ...it,
                categoryId: draftIdMap.get(it.categoryId) ?? it.categoryId,
              })),
              error: failureError,
            }
          : prev
      );
      return;
    }

    setPendingTxDraft(null);
  };

  const handleCancelTxDraft = () => {
    if (!pendingTxDraft || loading) return;
    const draft = pendingTxDraft;
    const newCatCount = draft.newCategories?.length ?? 0;
    setPendingTxDraft(null);
    if (newCatCount > 0) {
      appendChatMessage({
        id: `a-${Date.now()}`,
        role: "assistant",
        text: `ยกเลิกการสร้างหมวดหมู่ (${newCatCount} หมวด) และรายการบันทึกธุรกรรม (${draft.items.length} รายการ) แล้วค่ะ`,
      });
      return;
    }
    if (draft.items.length === 1) {
      const item = draft.items[0];
      appendChatMessage({
        id: `a-${Date.now()}`,
        role: "assistant",
        text:
          draft.source === "slip"
            ? "ยกเลิกรายการสลิปนี้แล้วค่ะ"
            : "ยกเลิกรายการบันทึกธุรกรรมนี้แล้วค่ะ",
        txAction: {
          status: "cancelled",
          type: item.type,
          merchant:
            item.merchant.trim() ||
            (draft.source === "slip" ? "รายการจากสลิป" : "รายการจาก AI"),
          ...(item.sender ? { sender: item.sender } : {}),
          ...(item.receiver ? { receiver: item.receiver } : {}),
          promptPayId: item.promptPayId || "-",
          amount: Number(item.amount) || 0,
          categoryId: item.categoryId,
          date: item.date,
        },
      });
    } else {
      appendChatMessage({
        id: `a-${Date.now()}`,
        role: "assistant",
        text: `ยกเลิกรายการบันทึกธุรกรรมทั้งหมด (${draft.items.length} รายการ) แล้วค่ะ`,
      });
    }
  };

  useDialogAccessibility(
    pendingTxDraft !== null,
    pendingDraftDialogRef,
    handleCancelTxDraft,
    !loading
  );

  const handleConfirmPendingTx = async (msg: ChatMessage) => {
    const action = msg.txAction;
    if (!action) return;
    const rawAmount = Number(pendingAmounts[msg.id] ?? action.amount);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) return;

    const txDate = action.date || todayYmd();
    setLoading(true);
    const saveRes = await addTransaction({
      title: action.merchant.trim() || "รายการจากสลิป",
      amount: rawAmount,
      type: action.type,
      categoryId: action.categoryId,
      channel: "สแกนสลิป (AI Chat)",
      date: ymdToIso(txDate),
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

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (inputLocked) return;
    const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
    if (file) {
      e.preventDefault();
      handleSlipFile(file);
    }
  };

  const canClearChat = chatMessages.length > 1 || pendingTxDraft !== null;

  return (
    <div className="flex flex-col gap-3 sm:gap-4 max-w-4xl mx-auto h-[calc(100dvh-6.25rem)] sm:h-[calc(100dvh-7.25rem)] lg:h-[calc(100dvh-8.25rem)] min-h-[420px]">
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight m-0">
            ผู้ช่วย AI &amp; สแกนสลิปอัตโนมัติ
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 line-clamp-2 sm:line-clamp-none">
            ถามคำถามการเงิน หรือส่งรูปสลิปธนาคารเพื่อให้บอทจัดหมวดหมู่และบันทึกรายรับ-รายจ่ายทันที
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
          <button
            type="button"
            disabled={!canClearChat || loading}
            onClick={() => setConfirmClearOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant/40 text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
            <span>ล้างแชท</span>
          </button>
          <Link href="/settings" className="text-xs font-semibold text-primary hover:underline">
            ตั้งค่า API Key →
          </Link>
        </div>
      </div>

      {/* Chat Stream Viewport (single inner scroll + sticky bottom composer) */}
      <div className="flex-1 min-h-0 rounded-2xl bg-surface-container border border-outline-variant/30 flex flex-col overflow-hidden">
        <div className="relative flex-1 min-h-0 flex flex-col">
          <div
            ref={chatScrollRef}
            onScroll={syncScrollToBottomButton}
            onWheel={(e) => {
              if (scrollAnimRef.current !== null || e.deltaY < 0) {
                userCancelledScrollRef.current = true;
                stopChatScrollAnimation();
              }
            }}
            onTouchStart={handleManualScrollInterrupt}
            onPointerDown={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              if (
                e.target === e.currentTarget &&
                e.clientX >= rect.left + e.currentTarget.clientWidth
              ) {
                handleManualScrollInterrupt();
              }
            }}
            className="flex-1 min-h-0 space-y-4 overflow-y-auto p-4 sm:p-5"
          >
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
                    className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${m.role === "user"
                      ? "bg-primary-container text-on-primary-container font-medium whitespace-pre-wrap"
                      : m.role === "error"
                        ? "bg-error-container/20 border border-error/40 text-on-error-container whitespace-pre-wrap"
                        : "bg-surface-container-low border border-outline-variant/20 text-on-surface"
                      }`}
                  >
                    {m.thumbnailUrl && (
                      <img
                        src={m.thumbnailUrl}
                        alt="Uploaded Slip"
                        onLoad={() => {
                          if (
                            !userCancelledScrollRef.current &&
                            (activeUserMediaIdRef.current === m.id || scrollAnimRef.current !== null)
                          ) {
                            animateChatScrollToBottom("media_load");
                          }
                        }}
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
                                className={`text-right font-semibold ${action.type === "income" ? "text-primary" : "text-secondary"
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
                              {action.date && (
                                <>
                                  <span>วันที่:</span>
                                  <span className="text-right font-mono text-on-surface">
                                    {formatThaiDate(action.date)}
                                  </span>
                                </>
                              )}
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
                            ยกเลิกรายการสลิป ({action.merchant}) แล้ว
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
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-on-surface-variant">
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
                                      className="px-2.5 py-1 rounded border border-outline-variant/50 bg-surface-container-low text-[11px] font-medium text-primary hover:bg-surface-container-high"
                                    >
                                      ผู้โอน ⇄ ผู้รับ
                                    </button>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  aria-label="ชื่อรายการหรือร้านค้า"
                                  value={action.merchant}
                                  onChange={(e) =>
                                    updateChatMessage(m.id, {
                                      txAction: { ...action, merchant: e.target.value },
                                    })
                                  }
                                  className="bg-surface-container border border-outline-variant/40 rounded px-2.5 py-1.5 text-xs font-semibold text-on-surface sm:text-right w-full sm:w-48 focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/35"
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

                              {pt.name === "add_category" && (
                                <div className="space-y-2.5">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[11px] text-on-surface-variant mb-1">
                                        ชื่อหมวดหมู่
                                      </label>
                                      <input
                                        type="text"
                                        aria-label="ชื่อหมวดหมู่"
                                        value={String(pt.args.name || "")}
                                        onChange={(e) =>
                                          updateToolArgs({ ...pt.args, name: e.target.value })
                                        }
                                        className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[11px] text-on-surface-variant mb-1">
                                        ประเภท
                                      </label>
                                      <select
                                        aria-label="ประเภทหมวดหมู่"
                                        value={pt.args.type === "income" ? "income" : "expense"}
                                        onChange={(e) => {
                                          const nextType =
                                            e.target.value === "income" ? "income" : "expense";
                                          const curIcon = String(pt.args.icon || "label");
                                          const nextIcon =
                                            nextType === "income"
                                              ? curIcon === "label"
                                                ? "payments"
                                                : curIcon
                                              : curIcon === "payments"
                                                ? "label"
                                                : curIcon;
                                          updateToolArgs({
                                            ...pt.args,
                                            type: nextType,
                                            budget:
                                              nextType === "income" ? 0 : pt.args.budget ?? 0,
                                            icon: nextIcon,
                                          });
                                        }}
                                        className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                                      >
                                        <option value="expense">หมวดรายจ่าย</option>
                                        <option value="income">หมวดรายรับ</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
                                    <IconColorPicker
                                      id={`tool-cat-picker-${m.id}`}
                                      label="ไอคอน & สี"
                                      colorSectionLabel="สีหมวดหมู่"
                                      dialogLabel="เลือกสีและไอคอนหมวดหมู่"
                                      icon={String(
                                        pt.args.icon ||
                                          (pt.args.type === "income" ? "payments" : "label")
                                      )}
                                      color={String(
                                        pt.args.color ||
                                          nextCategoryColor(categories.map((c) => c.color))
                                      )}
                                      onIconChange={(nextIcon) =>
                                        updateToolArgs({ ...pt.args, icon: nextIcon })
                                      }
                                      onColorChange={(nextColor) =>
                                        updateToolArgs({ ...pt.args, color: nextColor })
                                      }
                                    />
                                    {pt.args.type !== "income" && (
                                      <div>
                                        <label className="block text-[11px] text-on-surface-variant mb-1">
                                          งบประมาณต่อเดือน (บาท)
                                        </label>
                                        <input
                                          type="number"
                                          min="0"
                                          step="100"
                                          aria-label="งบประมาณต่อเดือน"
                                          value={
                                            pt.args.budget === "" ? "" : Number(pt.args.budget ?? 0)
                                          }
                                          onChange={(e) =>
                                            updateToolArgs({
                                              ...pt.args,
                                              budget:
                                                e.target.value === ""
                                                  ? ""
                                                  : Number(e.target.value),
                                            })
                                          }
                                          className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-2.5 py-1.5 text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
                                        />
                                      </div>
                                    )}
                                  </div>
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
                  {loadingStage === "slip_scan"
                    ? "กำลังอ่านสลิป (OCR) และวิเคราะห์ด้วย Finora AI..."
                    : loadingStage === "saving"
                      ? "กำลังบันทึกรายการ..."
                      : "กำลังประมวลผลด้วย Finora AI..."}
                </span>
              </div>
            )}
          </div>

          {showScrollToBottom && (
            <button
              type="button"
              onClick={() => {
                userCancelledScrollRef.current = false;
                animateChatScrollToBottom("user_action");
              }}
              aria-label="เลื่อนลงไปข้อความล่าสุด"
              title="เลื่อนลงไปข้อความล่าสุด"
              className="absolute right-4 bottom-3 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-high/95 backdrop-blur-md border border-outline-variant/50 shadow-md text-xs font-semibold text-on-surface hover:border-primary/60 hover:text-primary transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
              <span className="hidden sm:inline">ข้อความล่าสุด</span>
            </button>
          )}
        </div>

        {/* Empty-state Quick Suggestions right above composer */}
        {chatMessages.length <= 1 && (
          <div className="shrink-0 px-4 sm:px-5 pb-3 pt-1 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={inputLocked}
                onClick={() => sendPrompt(s)}
                className="text-xs px-3 py-1.5 rounded-full bg-surface-container-low border border-outline-variant/40 text-on-surface-variant hover:text-on-surface hover:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendPrompt(input);
          }}
          className="shrink-0 p-3 sm:p-4 border-t border-outline-variant/30 bg-surface-container flex items-end gap-2"
        >
          <label
            title="อัปโหลดรูปภาพสลิปโอนเงินหรือใบเสร็จ"
            className={`cursor-pointer inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[42px] rounded-lg bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface hover:border-primary/60 transition-colors shrink-0 ${inputLocked ? "opacity-50 pointer-events-none" : ""
              }`}
          >
            <span className="material-symbols-outlined text-[18px] text-primary">
              receipt_long
            </span>
            <span className="hidden sm:inline">ส่งสลิป</span>
            <input
              type="file"
              accept="image/*"
              disabled={inputLocked}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) handleSlipFile(f);
              }}
              className="hidden"
            />
          </label>

          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            disabled={inputLocked}
            onPaste={handlePaste}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (!inputLocked && input.trim()) {
                  sendPrompt(input);
                }
              }
            }}
            placeholder={
              hasPendingConfirmation
                ? "กรุณากดยืนยันหรือยกเลิกรายการก่อนส่งข้อความต่อ..."
                : "พิมพ์คำถาม (Enter ส่ง, Shift+Enter ขึ้นบรรทัดใหม่) หรือวางรูปสลิป..."
            }
            className="flex-1 resize-none bg-surface-container-low border border-outline-variant/40 rounded-lg px-4 py-2.5 text-sm leading-5 text-on-surface focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-60 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={inputLocked || !input.trim()}
            className="px-5 py-2.5 min-h-[42px] rounded-lg bg-primary-container text-on-primary-container text-sm font-semibold hover:opacity-90 disabled:opacity-50 shrink-0"
          >
            ส่ง
          </button>
        </form>
      </div>

      {/* Blocking Transaction Confirmation Modal (Slip & AI Chat Tool Batch) */}
      {pendingTxDraft && (() => {
        const isSlipSource = pendingTxDraft.source === "slip";
        const draftCats = pendingTxDraft.newCategories ?? [];
        const hasNewCats = draftCats.length > 0;
        const isBatch = pendingTxDraft.items.length > 1;
        const firstItem = pendingTxDraft.items[0];
        const fallbackCategoryIdForType = (
          txType: TransactionType,
          remainingDrafts: PendingCategoryItem[] = draftCats
        ) =>
          remainingDrafts.find((c) => c.type === txType)?.id ||
          categories.find((c) => c.type === txType && c.id !== "recurring")?.id ||
          (txType === "income" ? "salary" : "food");
        const updateDraftCategory = (catId: string, patch: Partial<PendingCategoryItem>) => {
          setPendingTxDraft((prev) => {
            if (!prev || !prev.newCategories) return prev;
            const nextCats = prev.newCategories.map((dc) =>
              dc.id === catId ? { ...dc, ...patch } : dc
            );
            const updatedCat = nextCats.find((dc) => dc.id === catId);
            const nextItems =
              updatedCat && patch.type
                ? prev.items.map((it) =>
                    it.categoryId === catId && it.type !== updatedCat.type
                      ? { ...it, categoryId: fallbackCategoryIdForType(it.type, nextCats) }
                      : it
                  )
                : prev.items;
            return { ...prev, error: undefined, newCategories: nextCats, items: nextItems };
          });
        };
        const removeDraftCategory = (catId: string) => {
          setPendingTxDraft((prev) => {
            if (!prev || !prev.newCategories) return prev;
            const nextCats = prev.newCategories.filter((dc) => dc.id !== catId);
            const nextItems = prev.items.map((it) =>
              it.categoryId === catId
                ? { ...it, categoryId: fallbackCategoryIdForType(it.type, nextCats) }
                : it
            );
            return {
              ...prev,
              error: undefined,
              newCategories: nextCats.length > 0 ? nextCats : undefined,
              items: nextItems,
            };
          });
        };
        const updateDraftItem = (itemId: string, patch: Partial<PendingTxItem>) => {
          setPendingTxDraft((prev) =>
            prev
              ? {
                  ...prev,
                  error: undefined,
                  items: prev.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
                }
              : prev
          );
        };
        const removeDraftItem = (itemId: string) => {
          setPendingTxDraft((prev) =>
            prev && prev.items.length > 1
              ? {
                  ...prev,
                  error: undefined,
                  items: prev.items.filter((it) => it.id !== itemId),
                }
              : prev
          );
        };
        const allCategoriesValid = draftCats.every(
          (dc) =>
            dc.name.trim().length > 0 &&
            (dc.type === "income" || dc.budget === "" || Number(dc.budget) >= 0)
        );
        const allItemsValid =
          allCategoriesValid &&
          pendingTxDraft.items.length > 0 &&
          pendingTxDraft.items.every(
            (it) => it.merchant.trim().length > 0 && Number(it.amount) > 0 && Boolean(it.date)
          );
        const modalTitle = isSlipSource
          ? "ตรวจสอบข้อมูลจากสลิป"
          : hasNewCats
            ? `ตรวจสอบหมวดหมู่ใหม่ (${draftCats.length}) และธุรกรรม (${pendingTxDraft.items.length})`
            : isBatch
              ? `ตรวจสอบรายการธุรกรรมจากแชท AI (${pendingTxDraft.items.length} รายการ)`
              : "ตรวจสอบรายการธุรกรรมจากแชท AI";

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-backdrop-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tx-confirm-modal-title"
          >
            <div
              ref={pendingDraftDialogRef}
              tabIndex={-1}
              className={`w-full ${isBatch || hasNewCats ? "max-w-2xl" : "max-w-lg"} max-h-[88vh] rounded-xl bg-surface-container border border-outline-variant/40 shadow-2xl overflow-hidden flex flex-col animate-modal-in focus:outline-none`}
            >
              <div className="shrink-0 flex items-start justify-between gap-3 px-6 py-4 border-b border-outline-variant/30">
                <div className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-primary text-[22px] mt-0.5">
                    receipt_long
                  </span>
                  <div>
                    <h2
                      id="tx-confirm-modal-title"
                      className="text-lg font-semibold text-on-surface m-0"
                    >
                      {modalTitle}
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
                  handleConfirmTxDraft();
                }}
                className="flex-1 min-h-0 flex flex-col"
              >
                <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
                  {pendingTxDraft.thumbnailUrl && firstItem && (
                    <div className="flex items-center gap-3.5 p-3 rounded-lg bg-surface-container-low border border-outline-variant/30">
                      <img
                        src={pendingTxDraft.thumbnailUrl}
                        alt="Slip Preview"
                        className="h-16 w-16 object-contain rounded-md bg-white p-1 border border-outline-variant/30 shrink-0"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-on-surface truncate">
                            {firstItem.merchant || "รายการจากสลิป"}
                          </span>
                          {firstItem.needsAmount && (
                            <span className="px-2 py-0.5 rounded-full bg-secondary/15 text-secondary text-[10px] font-semibold">
                              ต้องกรอกยอดเงิน
                            </span>
                          )}
                        </div>
                        {firstItem.promptPayId && firstItem.promptPayId !== "-" && (
                          <div className="text-[11px] font-mono text-on-surface-variant truncate">
                            PromptPay / Ref: {firstItem.promptPayId}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {hasNewCats && (
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-primary uppercase tracking-wider">
                        หมวดหมู่ใหม่ที่จะสร้าง ({draftCats.length} หมวด)
                      </div>
                      {draftCats.map((dc, cIdx) => (
                        <div
                          key={dc.id}
                          className="rounded-xl border border-primary/30 bg-primary-container/5 p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between gap-2 pb-1 border-b border-outline-variant/20">
                            <span className="text-xs font-bold text-primary">
                              หมวดหมู่ใหม่ #{cIdx + 1}
                            </span>
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => removeDraftCategory(dc.id)}
                              title="นำหมวดหมู่นี้ออก"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-on-surface-variant hover:text-error hover:bg-error-container/20 disabled:opacity-40"
                            >
                              <span className="material-symbols-outlined text-[14px]">close</span>
                              <span>นำออก</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label
                                htmlFor={`tx-modal-newcat-name-${cIdx}`}
                                className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1"
                              >
                                ชื่อหมวดหมู่
                              </label>
                              <input
                                id={`tx-modal-newcat-name-${cIdx}`}
                                type="text"
                                disabled={loading}
                                value={dc.name}
                                onChange={(e) =>
                                  updateDraftCategory(dc.id, { name: e.target.value })
                                }
                                className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor={`tx-modal-newcat-type-${cIdx}`}
                                className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1"
                              >
                                ประเภทหมวดหมู่
                              </label>
                              <select
                                id={`tx-modal-newcat-type-${cIdx}`}
                                disabled={loading}
                                value={dc.type}
                                onChange={(e) => {
                                  const nextType: TransactionType =
                                    e.target.value === "income" ? "income" : "expense";
                                  const nextIcon =
                                    nextType === "income"
                                      ? dc.icon === "label"
                                        ? "payments"
                                        : dc.icon
                                      : dc.icon === "payments"
                                        ? "label"
                                        : dc.icon;
                                  updateDraftCategory(dc.id, {
                                    type: nextType,
                                    budget: nextType === "income" ? "0" : dc.budget,
                                    icon: nextIcon,
                                  });
                                }}
                                className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
                              >
                                <option value="expense">หมวดรายจ่าย</option>
                                <option value="income">หมวดรายรับ</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                            <IconColorPicker
                              id={`modal-newcat-picker-${dc.id}`}
                              label="ไอคอน & สี"
                              colorSectionLabel="สีหมวดหมู่"
                              dialogLabel="เลือกสีและไอคอนหมวดหมู่"
                              icon={dc.icon}
                              color={dc.color}
                              onIconChange={(nextIcon) =>
                                updateDraftCategory(dc.id, { icon: nextIcon })
                              }
                              onColorChange={(nextColor) =>
                                updateDraftCategory(dc.id, { color: nextColor })
                              }
                            />
                            {dc.type !== "income" && (
                              <div>
                                <label
                                  htmlFor={`tx-modal-newcat-budget-${cIdx}`}
                                  className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1"
                                >
                                  งบประมาณต่อเดือน (THB)
                                </label>
                                <input
                                  id={`tx-modal-newcat-budget-${cIdx}`}
                                  type="number"
                                  min="0"
                                  step="100"
                                  disabled={loading}
                                  placeholder="0"
                                  value={dc.budget}
                                  onChange={(e) =>
                                    updateDraftCategory(dc.id, { budget: e.target.value })
                                  }
                                  className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm font-mono text-on-surface focus:outline-none focus:border-primary"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {pendingTxDraft.items.map((item, idx) => {
                    const canSwapParties = Boolean(
                      item.sender && item.receiver && item.sender !== item.receiver
                    );
                    const matchingDraftCats = draftCats
                      .filter((c) => c.type === item.type)
                      .map((c) => ({
                        id: c.id,
                        name: `${c.name.trim() || "หมวดใหม่"} (หมวดใหม่)`,
                      }));
                    const existingModalCats = categories
                      .filter((c) => c.type === item.type && c.id !== "recurring")
                      .map((c) => ({ id: c.id, name: c.name }));
                    const modalCats = [...matchingDraftCats, ...existingModalCats];
                    const handleSwitchType = (nextType: TransactionType) => {
                      const firstCat =
                        categories.find((c) => c.type === nextType && c.id !== "recurring")
                          ?.id || (nextType === "income" ? "salary" : "food");
                      const nextMerchant =
                        canSwapParties &&
                        (item.merchant === item.sender || item.merchant === item.receiver)
                          ? nextType === "income"
                            ? item.sender!
                            : item.receiver!
                          : item.merchant;
                      updateDraftItem(item.id, {
                        type: nextType,
                        categoryId: firstCat,
                        merchant: nextMerchant,
                      });
                    };

                    return (
                      <div
                        key={item.id}
                        className={
                          isBatch || hasNewCats
                            ? "rounded-xl border border-outline-variant/30 bg-surface-container-low/40 p-4 space-y-3"
                            : "space-y-4"
                        }
                      >
                        {(isBatch || hasNewCats) && (
                          <div className="flex items-center justify-between gap-2 pb-1 border-b border-outline-variant/20">
                            <span className="text-xs font-bold text-primary">
                              {isBatch ? `รายการที่ ${idx + 1}` : "รายการธุรกรรม"}
                            </span>
                            {isBatch && (
                              <button
                                type="button"
                                disabled={loading}
                                onClick={() => removeDraftItem(item.id)}
                                title="นำรายการนี้ออก"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-on-surface-variant hover:text-error hover:bg-error-container/20 disabled:opacity-40"
                              >
                                <span className="material-symbols-outlined text-[14px]">close</span>
                                <span>นำออก</span>
                              </button>
                            )}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-surface-container-low">
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleSwitchType("expense")}
                            className={`py-2 rounded-md text-sm font-semibold transition-colors ${
                              item.type === "expense"
                                ? "bg-secondary text-on-secondary shadow-sm"
                                : "text-on-surface-variant hover:text-on-surface"
                            }`}
                          >
                            รายจ่าย
                          </button>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleSwitchType("income")}
                            className={`py-2 rounded-md text-sm font-semibold transition-colors ${
                              item.type === "income"
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
                              htmlFor={`tx-modal-merchant-${idx}`}
                              className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider"
                            >
                              รายการ / ร้านค้า
                            </label>
                            {canSwapParties && (
                              <button
                                type="button"
                                disabled={loading}
                                title={`ผู้โอน: ${item.sender} | ผู้รับ: ${item.receiver}`}
                                onClick={() =>
                                  updateDraftItem(item.id, {
                                    merchant:
                                      item.merchant === item.receiver
                                        ? item.sender!
                                        : item.receiver!,
                                  })
                                }
                                className="px-2 py-0.5 rounded border border-outline-variant/50 bg-surface-container-low text-[11px] font-medium text-primary hover:bg-surface-container-high"
                              >
                                ผู้โอน ⇄ ผู้รับ
                              </button>
                            )}
                          </div>
                          <input
                            id={`tx-modal-merchant-${idx}`}
                            type="text"
                            disabled={loading}
                            value={item.merchant}
                            onChange={(e) =>
                              updateDraftItem(item.id, { merchant: e.target.value })
                            }
                            className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label
                              htmlFor={`tx-modal-category-${idx}`}
                              className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5"
                            >
                              หมวดหมู่
                            </label>
                            <select
                              id={`tx-modal-category-${idx}`}
                              disabled={loading}
                              value={item.categoryId}
                              onChange={(e) =>
                                updateDraftItem(item.id, { categoryId: e.target.value })
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
                              htmlFor={`tx-modal-amount-${idx}`}
                              className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5"
                            >
                              จำนวนเงิน (THB)
                            </label>
                            <input
                              id={`tx-modal-amount-${idx}`}
                              type="number"
                              min="0.01"
                              step="0.01"
                              autoFocus={idx === 0 && Boolean(item.needsAmount)}
                              disabled={loading}
                              placeholder="0.00"
                              value={item.amount}
                              onChange={(e) =>
                                updateDraftItem(item.id, { amount: e.target.value })
                              }
                              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2.5 text-sm font-mono text-on-surface focus:outline-none focus:border-primary"
                            />
                          </div>
                        </div>

                        <div
                          className={`grid grid-cols-1 ${
                            !isSlipSource ? "sm:grid-cols-2" : ""
                          } gap-3`}
                        >
                          {!isSlipSource && (
                            <div>
                              <label
                                htmlFor={`tx-modal-channel-${idx}`}
                                className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5"
                              >
                                ช่องทางการชำระเงิน
                              </label>
                              <select
                                id={`tx-modal-channel-${idx}`}
                                disabled={loading}
                                value={item.channel}
                                onChange={(e) =>
                                  updateDraftItem(item.id, { channel: e.target.value })
                                }
                                className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary"
                              >
                                <option value="Virtual Bank Wallet">Virtual Bank Wallet</option>
                                <option value="สแกน PromptPay QR">สแกน PromptPay QR</option>
                                <option value="Virtual Card">Virtual Card</option>
                                <option value="เงินสด">เงินสด</option>
                              </select>
                            </div>
                          )}

                          <div>
                            <label
                              htmlFor={`tx-modal-date-${idx}`}
                              className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5"
                            >
                              วันที่ทำรายการ
                            </label>
                            <input
                              id={`tx-modal-date-${idx}`}
                              type="date"
                              required
                              disabled={loading}
                              value={item.date}
                              onChange={(e) =>
                                updateDraftItem(item.id, { date: e.target.value })
                              }
                              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3.5 py-2.5 text-sm font-mono text-on-surface focus:outline-none focus:border-primary"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {pendingTxDraft.error && (
                    <p role="alert" className="text-xs text-error font-medium">
                      {pendingTxDraft.error}
                    </p>
                  )}
                </div>

                <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-outline-variant/30 bg-surface-container-low/40">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleCancelTxDraft}
                    className="px-4 py-2 rounded-lg text-sm font-medium border border-outline-variant/40 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high disabled:opacity-50"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !allItemsValid}
                    className="px-5 py-2 rounded-lg text-sm font-semibold bg-primary-container text-on-primary-container hover:opacity-90 disabled:opacity-50 shadow-sm"
                  >
                    {loading
                      ? "กำลังบันทึก..."
                      : hasNewCats
                        ? "ยืนยันสร้างหมวดและบันทึกทั้งหมด"
                        : isBatch
                          ? `ยืนยันบันทึกทั้งหมด (${pendingTxDraft.items.length} รายการ)`
                          : "ยืนยันบันทึก"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Clear Chat Confirmation Modal */}
      <ConfirmDialog
        open={confirmClearOpen}
        title="ต้องการล้างประวัติการสนทนาใช่ไหม?"
        description="ข้อความและประวัติแชทในเซสชันนี้จะถูกลบออกทั้งหมด (รายการธุรกรรมที่บันทึกในระบบแล้วจะไม่ถูกลบ)"
        confirmLabel="ยืนยันล้างแชท"
        icon="delete_sweep"
        onConfirm={() => {
          setConfirmClearOpen(false);
          setPendingTxDraft(null);
          clearChatMessages();
        }}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </div>
  );
}
