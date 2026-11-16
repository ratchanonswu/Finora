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
  { id: "salary", name: "เงินเดือน & โบนัส", icon: "payments", color: "#059669", budget: 0, type: "income" },
  { id: "investment", name: "เงินปันผล & การลงทุน", icon: "show_chart", color: "#CA8A04", budget: 0, type: "income" },
];

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
    categoryId: "entertainment",
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
  { id: "rec-1", title: "Netflix Premium Ultra HD", amount: 419, categoryId: "entertainment", cycle: "monthly", nextDueDate: "2025-04-01", active: true, icon: "movie" },
  { id: "rec-2", title: "ค่าเช่าคอนโด Ashton Asoke", amount: 11500, categoryId: "housing", cycle: "monthly", nextDueDate: "2025-04-05", active: true, icon: "apartment" },
  { id: "rec-3", title: "AIS Fibre 1Gbps + Mobile", amount: 899, categoryId: "housing", cycle: "monthly", nextDueDate: "2025-04-10", active: true, icon: "wifi" },
  { id: "rec-4", title: "Spotify Duo", amount: 189, categoryId: "entertainment", cycle: "monthly", nextDueDate: "2025-04-15", active: false, icon: "music_note" },
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
};

export function formatTHB(amount: number): string {
  return `฿${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatThaiDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
