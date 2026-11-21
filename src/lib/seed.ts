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

export function relativeDateYmd(offsetDays: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function relativeDateIso(offsetDays: number, timeStr = "12:00:00"): string {
  return `${relativeDateYmd(offsetDays)}T${timeStr}+07:00`;
}

// Each category gets its own hue; red/green stay reserved for expense/income amounts.
export const INITIAL_CATEGORIES: Category[] = [
  { id: "food", name: "อาหาร & เครื่องดื่ม", icon: "restaurant", color: "#EA580C", budget: 10000, type: "expense" },
  { id: "shopping", name: "ช้อปปิ้ง & ไลฟ์สไตล์", icon: "shopping_bag", color: "#8B5CF6", budget: 8000, type: "expense" },
  { id: "housing", name: "ที่อยู่อาศัย & บิล", icon: "home", color: "#0284C7", budget: 15000, type: "expense" },
  { id: "transport", name: "การเดินทาง & น้ำมัน", icon: "directions_car", color: "#4F46E5", budget: 5000, type: "expense" },
  { id: "entertainment", name: "ความบันเทิง & สมาชิก", icon: "subscriptions", color: "#DB2777", budget: 3000, type: "expense" },
  { id: "recurring", name: "รายจ่ายประจำ (Recurring)", icon: "autorenew", color: "#0D9488", budget: 13500, type: "expense" },
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
    ref: "TXN-1001",
    title: "Gourmet Market Paragon",
    amount: 1500,
    type: "expense",
    categoryId: "food",
    channel: "สแกน PromptPay QR",
    date: relativeDateIso(-1, "18:30:00"),
    status: "completed",
  },
  {
    id: "tx-2",
    ref: "TXN-1002",
    title: "เติมน้ำมัน PTT Station",
    amount: 1000,
    type: "expense",
    categoryId: "transport",
    channel: "สแกน PromptPay QR",
    date: relativeDateIso(-2, "10:15:00"),
    status: "completed",
  },
  {
    id: "tx-3",
    ref: "TXN-1003",
    title: "Uniqlo Central World",
    amount: 2500,
    type: "expense",
    categoryId: "shopping",
    channel: "Virtual Card",
    date: relativeDateIso(-3, "14:15:00"),
    status: "completed",
  },
  {
    id: "tx-4",
    ref: "DIV-1004",
    title: "เงินปันผลกองทุนรวม K-USXNDQ",
    amount: 5000,
    type: "income",
    categoryId: "investment",
    channel: "Virtual Bank Wallet",
    date: relativeDateIso(-4, "11:20:00"),
    status: "completed",
  },
  {
    id: "tx-5",
    ref: "INC-1005",
    title: "เงินโอนตั้งต้นเข้ากระเป๋า",
    amount: 10000,
    type: "income",
    categoryId: "salary",
    channel: "Virtual Bank Wallet",
    date: relativeDateIso(-5, "09:00:00"),
    status: "completed",
  },
];

export const INITIAL_RECURRING: RecurringPayment[] = [
  { id: "rec-1", title: "Netflix Premium Ultra HD", amount: 500, categoryId: "recurring", cycle: "monthly", nextDueDate: relativeDateYmd(1), active: true, icon: "movie" },
  { id: "rec-2", title: "ค่าเช่าคอนโด Ashton Asoke", amount: 12000, categoryId: "recurring", cycle: "monthly", nextDueDate: relativeDateYmd(3), active: true, icon: "apartment" },
  { id: "rec-salary", title: "เงินเดือนประจำ", amount: 50000, type: "income", categoryId: "salary", cycle: "monthly", nextDueDate: relativeDateYmd(7), active: true, icon: "payments" },
  { id: "rec-3", title: "AIS Fibre 1Gbps + Mobile", amount: 1000, categoryId: "recurring", cycle: "monthly", nextDueDate: relativeDateYmd(10), active: true, icon: "wifi" },
  { id: "rec-4", title: "Spotify Duo", amount: 200, categoryId: "recurring", cycle: "monthly", nextDueDate: relativeDateYmd(15), active: false, icon: "music_note" },
];

export const INITIAL_BANK_BALANCE = 10000;

export const INITIAL_LEDGER: BankLedgerEntry[] = [
  { id: "l-1", ref: "VB-1001", type: "debit", title: "ชำระเงิน PromptPay QR", counterparty: "Gourmet Market Paragon", amount: 1500, balanceAfter: 10000, date: relativeDateIso(-1, "18:30:00") },
  { id: "l-2", ref: "VB-1002", type: "debit", title: "ชำระเงิน PromptPay QR", counterparty: "PTT Station", amount: 1000, balanceAfter: 11500, date: relativeDateIso(-2, "10:15:00") },
  { id: "l-3", ref: "VB-1003", type: "debit", title: "ชำระเงิน Virtual Card", counterparty: "Uniqlo Central World", amount: 2500, balanceAfter: 12500, date: relativeDateIso(-3, "14:15:00") },
  { id: "l-4", ref: "VB-1004", type: "credit", title: "เงินปันผลโอนเข้าบัญชี", counterparty: "K-USXNDQ Dividend", amount: 5000, balanceAfter: 15000, date: relativeDateIso(-4, "11:20:00") },
  { id: "l-5", ref: "VB-1005", type: "credit", title: "เงินโอนตั้งต้นเข้ากระเป๋า", counterparty: "Finora Initial Deposit", amount: 10000, balanceAfter: 10000, date: relativeDateIso(-5, "09:00:00") },
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

export function todayYmd(): string {
  return relativeDateYmd(0);
}

export function ymdToIso(ymd: string): string {
  const safe = /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : todayYmd();
  return `${safe}T12:00:00+07:00`;
}

export function toDateInputValue(isoOrYmd?: string): string {
  const trimmed = String(isoOrYmd || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (trimmed) {
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) {
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yy}-${mm}-${dd}`;
    }
  }
  return todayYmd();
}

function buildValidYmd(yearInput: number, month: number, day: number): string | null {
  const year = yearInput >= 2400 ? yearInput - 543 : yearInput;
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function roundCurrency(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

const RELATIVE_DATE_OFFSETS: Record<string, number> = {
  วันนี้: 0,
  today: 0,
  เมื่อวาน: -1,
  เมื่อวานนี้: -1,
  yesterday: -1,
  เมื่อวานซืน: -2,
  พรุ่งนี้: 1,
  tomorrow: 1,
};

export function normalizeTransactionDate(raw: unknown, refDate = new Date()): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;

  const relOffset = RELATIVE_DATE_OFFSETS[text.toLowerCase()];
  if (relOffset !== undefined) {
    const target = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() + relOffset);
    return buildValidYmd(target.getFullYear(), target.getMonth() + 1, target.getDate());
  }

  const isoMatch = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
  if (isoMatch) {
    return buildValidYmd(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const dmyYearMatch = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (dmyYearMatch) {
    let year = Number(dmyYearMatch[3]);
    if (dmyYearMatch[3].length === 2) {
      year = year >= 40 ? 2500 + year - 543 : 2000 + year;
    }
    return buildValidYmd(year, Number(dmyYearMatch[2]), Number(dmyYearMatch[1]));
  }

  const dmMatch = text.match(/^(\d{1,2})[-/](\d{1,2})$/);
  if (dmMatch) {
    return buildValidYmd(refDate.getFullYear(), Number(dmMatch[2]), Number(dmMatch[1]));
  }

  return null;
}

export function formatTHB(amount: number): string {
  const abs = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-฿${abs}` : `฿${abs}`;
}

export function formatThaiDate(iso: string): string {
  const trimmed = String(iso || "").trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T12:00:00+07:00`)
    : new Date(trimmed);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
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
