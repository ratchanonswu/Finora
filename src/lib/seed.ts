import type {
  AppSettings,
  BankLedgerEntry,
  Category,
  RecurringPayment,
  Transaction,
  UserProfile,
} from "./types.ts";

export const INITIAL_USER: UserProfile = {
  name: "คุณธนภัทร วงศ์เจริญ",
  email: "thanapat@finora.io",
  role: "",
  isLoggedIn: false,
};

// Each category gets its own hue; red/green stay reserved for expense/income amounts.
export const INITIAL_CATEGORIES: Category[] = [
  { id: "food", name: "อาหาร & เครื่องดื่ม", icon: "restaurant", color: "#EA580C", budget: 15000, type: "expense" },
  { id: "shopping", name: "ช้อปปิ้ง & ไลฟ์สไตล์", icon: "shopping_bag", color: "#8B5CF6", budget: 10000, type: "expense" },
  { id: "housing", name: "ที่อยู่อาศัย & บิล", icon: "home", color: "#0284C7", budget: 12000, type: "expense" },
  { id: "transport", name: "การเดินทาง & น้ำมัน", icon: "directions_car", color: "#4F46E5", budget: 6000, type: "expense" },
  { id: "entertainment", name: "ความบันเทิง & สมาชิก", icon: "subscriptions", color: "#DB2777", budget: 4000, type: "expense" },
  { id: "recurring", name: "รายจ่ายประจำ (Recurring)", icon: "autorenew", color: "#0D9488", budget: 12818, type: "expense" },
  { id: "salary", name: "เงินเดือน & โบนัส", icon: "payments", color: "#059669", budget: 0, type: "income" },
  { id: "investment", name: "เงินปันผล & การลงทุน", icon: "show_chart", color: "#CA8A04", budget: 0, type: "income" },
];

export function computeRecurringMonthlyBudget(recurring: RecurringPayment[]): number {
  return Math.round(
    recurring
      .filter((r) => r.active && (r.type ?? "expense") === "expense")
      .reduce((s, r) => s + (r.cycle === "yearly" ? r.amount / 12 : r.amount), 0)
  );
}

export const BASE_CATEGORY_IDS = new Set(INITIAL_CATEGORIES.map((c) => c.id));

export function isBaseCategory(id: string): boolean {
  return BASE_CATEGORY_IDS.has(id);
}

// Colors handed to user-created categories, in order, skipping ones already in use.
export const CATEGORY_PALETTE = ["#0891B2", "#C026D3", "#65A30D", "#B45309", "#475569", "#7C3AED", "#0D9488", "#BE185D"];

export function nextCategoryColor(used: string[]): string {
  const taken = new Set(used.map((c) => c.toUpperCase()));
  return CATEGORY_PALETTE.find((c) => !taken.has(c)) ?? CATEGORY_PALETTE[used.length % CATEGORY_PALETTE.length];
}

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: "tx-1",
    ref: "TXN-20250302-1102",
    title: "Gourmet Market Paragon",
    amount: 2450,
    type: "expense",
    categoryId: "food",
    channel: "สแกน PromptPay QR",
    date: "2025-03-02T18:30:00+07:00",
    status: "completed",
  },
  {
    id: "tx-2",
    ref: "REC-20250301-4431",
    title: "Netflix Subscription",
    amount: 419,
    type: "expense",
    categoryId: "recurring",
    channel: "Virtual Bank Auto-Debit",
    date: "2025-03-01T00:01:00+07:00",
    status: "completed",
  },
  {
    id: "tx-3",
    ref: "TXN-20250228-9842",
    title: "เงินเดือนประจำ (บจก. เทค อินโนเวชั่น)",
    amount: 85000,
    type: "income",
    categoryId: "salary",
    channel: "Virtual Bank Wallet",
    date: "2025-02-28T09:00:00+07:00",
    status: "completed",
  },
  {
    id: "tx-4",
    ref: "TXN-20250227-7729",
    title: "Apple Store Central World",
    amount: 8900,
    type: "expense",
    categoryId: "shopping",
    channel: "Virtual Card",
    date: "2025-02-27T14:15:00+07:00",
    status: "completed",
  },
  {
    id: "tx-5",
    ref: "DIV-20250225-0193",
    title: "เงินปันผลกองทุนรวม K-USXNDQ",
    amount: 4320,
    type: "income",
    categoryId: "investment",
    channel: "โอนเข้าบัญชีจำลอง",
    date: "2025-02-25T11:20:00+07:00",
    status: "completed",
  },
];

export const INITIAL_RECURRING: RecurringPayment[] = [
  { id: "rec-1", title: "Netflix Premium Ultra HD", amount: 419, categoryId: "recurring", cycle: "monthly", nextDueDate: "2025-04-01", active: true, icon: "movie" },
  { id: "rec-2", title: "ค่าเช่าคอนโด Ashton Asoke", amount: 11500, categoryId: "recurring", cycle: "monthly", nextDueDate: "2025-04-05", active: true, icon: "apartment" },
  { id: "rec-3", title: "AIS Fibre 1Gbps + Mobile", amount: 899, categoryId: "recurring", cycle: "monthly", nextDueDate: "2025-04-10", active: true, icon: "wifi" },
  { id: "rec-4", title: "Spotify Duo", amount: 189, categoryId: "recurring", cycle: "monthly", nextDueDate: "2025-04-15", active: false, icon: "music_note" },
];

export const INITIAL_BANK_BALANCE = 124500;

export const INITIAL_LEDGER: BankLedgerEntry[] = [
  { id: "l-1", ref: "VB-20250302-01", type: "debit", title: "ชำระเงิน PromptPay QR", counterparty: "Gourmet Market Paragon", amount: 2450, balanceAfter: 124500, date: "2025-03-02T18:30:00+07:00" },
  { id: "l-2", ref: "VB-20250301-02", type: "debit", title: "หักบัญชีอัตโนมัติ", counterparty: "Netflix Thailand", amount: 419, balanceAfter: 126950, date: "2025-03-01T00:01:00+07:00" },
  { id: "l-3", ref: "VB-20250228-03", type: "credit", title: "เงินเดือนโอนเข้าบัญชี", counterparty: "Tech Innovation Co., Ltd.", amount: 85000, balanceAfter: 127369, date: "2025-02-28T09:00:00+07:00" },
];

export const INITIAL_SETTINGS: AppSettings = {
  currency: "THB",
  autoDebitOnExpense: true,
  pinConfirmThreshold: 5000,
  notifyUpcomingBills: true,
  notifyBudget80: true,
  aiAutoCategorize: true,
  aiConfidenceThreshold: 85,
  geminiApiKeyOverride: "",
  monthlySalary: 55000,
  salaryPayday: 25,
  quotaResetDay: 1,
};

export function isInCurrentQuotaCycle(txDate: string, quotaResetAt?: string): boolean {
  if (!quotaResetAt) return true;
  return new Date(txDate).getTime() > new Date(quotaResetAt).getTime();
}

export function advanceDueDate(dateStr: string, cycle: "monthly" | "weekly" | "yearly"): string {
  const [y, m, day] = dateStr.split("-").map(Number);
  if (!y || !m || !day) return dateStr;
  const d = new Date(y, m - 1, day);
  if (cycle === "weekly") d.setDate(d.getDate() + 7);
  else if (cycle === "yearly") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function formatTHB(amount: number): string {
  return `฿${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatThaiDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Parses EMVCo TLV payload from Thai PromptPay QR strings (tag 29/30 ID, tag 54 amount, tag 59 merchant).
export function parsePromptPayPayload(raw: string): {
  merchant?: string;
  promptPayId?: string;
  amount?: number;
  isPromptPayOrSlip?: boolean;
} {
  let i = 0;
  const out: {
    merchant?: string;
    promptPayId?: string;
    amount?: number;
    isPromptPayOrSlip?: boolean;
  } = {};
  if (raw.startsWith("000201") || raw.startsWith("00410006000001")) {
    out.isPromptPayOrSlip = true;
  }
  while (i + 4 <= raw.length) {
    const tag = raw.slice(i, i + 2);
    const len = Number(raw.slice(i + 2, i + 4));
    if (!Number.isFinite(len) || len < 0 || i + 4 + len > raw.length) break;
    const val = raw.slice(i + 4, i + 4 + len);
    if (tag === "54" && Number(val) > 0) out.amount = Number(val);
    if (tag === "59" && val.trim() && val.trim().toUpperCase() !== "TH") {
      out.merchant = val.trim();
    }
    if (tag === "29" || tag === "30") {
      out.isPromptPayOrSlip = true;
      let j = 0;
      while (j + 4 <= val.length) {
        const subTag = val.slice(j, j + 2);
        const subLen = Number(val.slice(j + 2, j + 4));
        if (!Number.isFinite(subLen) || subLen < 0 || j + 4 + subLen > val.length) break;
        const subVal = val.slice(j + 4, j + 4 + subLen);
        if (tag === "29" && (subTag === "01" || subTag === "02" || subTag === "03")) {
          out.promptPayId = subVal.replace(/^0066(\d{9})$/, "0$1");
        } else if (tag === "30" && subTag === "01") {
          out.promptPayId = subVal;
        }
        j += 4 + subLen;
      }
    }
    i += 4 + len;
  }
  return out;
}
