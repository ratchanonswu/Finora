import type {
  AppSettings,
  BankLedgerEntry,
  Category,
  RecurringPayment,
  Transaction,
  UserProfile,
} from "./types.ts";

export const INITIAL_USER: UserProfile = {
  name: "นายรัชชานนท์ แก้วกูล",
  email: "ratchanon@finora.io",
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

function monthDayIso(monthOffset: number, day: number, timeStr = "12:00:00"): string {
  const now = new Date();
  const targetMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const lastDayOfTarget = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth() + 1,
    0
  ).getDate();
  const maxAllowedDay =
    monthOffset === 0 ? Math.min(now.getDate(), lastDayOfTarget) : lastDayOfTarget;
  const clampedDay = Math.max(1, Math.min(day, maxAllowedDay));
  const yy = targetMonth.getFullYear();
  const mm = String(targetMonth.getMonth() + 1).padStart(2, "0");
  const dd = String(clampedDay).padStart(2, "0");
  return `${yy}-${mm}-${dd}T${timeStr}+07:00`;
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

const RAW_INITIAL_TRANSACTIONS: Transaction[] = [
  // --- Current Month (monthOffset = 0, 22 items: Income 50,000 | Expense 37,250) ---
  { id: "tx-1", ref: "TXN-3022", title: "Gourmet Market Paragon", amount: 1850, type: "expense", categoryId: "food", channel: "สแกน PromptPay QR", date: monthDayIso(0, 22, "19:20:00"), status: "completed" },
  { id: "tx-2", ref: "TXN-3021", title: "GrabCar & ทางด่วน Easy Pass", amount: 900, type: "expense", categoryId: "transport", channel: "Virtual Bank Wallet", date: monthDayIso(0, 21, "18:45:00"), status: "completed" },
  { id: "tx-3", ref: "TXN-3020", title: "Lazada อุปกรณ์โต๊ะทำงาน", amount: 900, type: "expense", categoryId: "shopping", channel: "Virtual Card", date: monthDayIso(0, 20, "21:10:00"), status: "completed" },
  { id: "tx-4", ref: "TXN-3019", title: "Starbucks & คาเฟ่ทำงาน", amount: 980, type: "expense", categoryId: "food", channel: "สแกน PromptPay QR", date: monthDayIso(0, 19, "10:15:00"), status: "completed" },
  { id: "tx-5", ref: "TXN-3018", title: "เติมเกม Steam", amount: 970, type: "expense", categoryId: "entertainment", channel: "Virtual Card", date: monthDayIso(0, 18, "22:05:00"), status: "completed" },
  { id: "tx-6", ref: "TXN-3017", title: "Mo-Mo-Paradise ชาบู", amount: 1490, type: "expense", categoryId: "food", channel: "สแกน PromptPay QR", date: monthDayIso(0, 17, "19:30:00"), status: "completed" },
  { id: "tx-7", ref: "INC-3016", title: "ค่าที่ปรึกษาโปรเจกต์พิเศษ", amount: 1500, type: "income", categoryId: "salary", channel: "Virtual Bank Wallet", date: monthDayIso(0, 16, "16:00:00"), status: "completed" },
  { id: "tx-8", ref: "TXN-3015", title: "Shopee แกดเจ็ต & ของใช้", amount: 2460, type: "expense", categoryId: "shopping", channel: "Virtual Card", date: monthDayIso(0, 15, "20:15:00"), status: "completed" },
  { id: "tx-9", ref: "TXN-3014", title: "เติมน้ำมัน PTT Station", amount: 1450, type: "expense", categoryId: "transport", channel: "สแกน PromptPay QR", date: monthDayIso(0, 14, "08:50:00"), status: "completed" },
  { id: "tx-10", ref: "TXN-3013", title: "ร้านอาหารญี่ปุ่น Maguro", amount: 1620, type: "expense", categoryId: "food", channel: "Virtual Card", date: monthDayIso(0, 13, "19:00:00"), status: "completed" },
  { id: "tx-11", ref: "TXN-3012", title: "ตั๋วหนัง Major Cineplex IMAX", amount: 780, type: "expense", categoryId: "entertainment", channel: "สแกน PromptPay QR", date: monthDayIso(0, 12, "15:20:00"), status: "completed" },
  { id: "tx-12", ref: "TXN-3011", title: "Uniqlo Central World", amount: 2890, type: "expense", categoryId: "shopping", channel: "Virtual Card", date: monthDayIso(0, 11, "14:40:00"), status: "completed" },
  { id: "tx-13", ref: "DIV-3010", title: "เงินปันผลกองทุนรวม K-USXNDQ", amount: 3500, type: "income", categoryId: "investment", channel: "Virtual Bank Wallet", date: monthDayIso(0, 10, "11:20:00"), status: "completed" },
  { id: "tx-14", ref: "TXN-3009", title: "GrabFood มื้อกลางวัน", amount: 1190, type: "expense", categoryId: "food", channel: "สแกน PromptPay QR", date: monthDayIso(0, 9, "12:25:00"), status: "completed" },
  { id: "tx-15", ref: "TXN-3008", title: "ค่าไฟฟ้า การไฟฟ้านครหลวง", amount: 1150, type: "expense", categoryId: "housing", channel: "Virtual Bank Wallet", date: monthDayIso(0, 8, "09:40:00"), status: "completed" },
  { id: "tx-16", ref: "TXN-3007", title: "Nike Store Siam Center", amount: 3200, type: "expense", categoryId: "shopping", channel: "Virtual Card", date: monthDayIso(0, 7, "17:10:00"), status: "completed" },
  { id: "tx-17", ref: "TXN-3006", title: "เติมบัตรรถไฟฟ้า BTS", amount: 1100, type: "expense", categoryId: "transport", channel: "สแกน PromptPay QR", date: monthDayIso(0, 6, "08:15:00"), status: "completed" },
  { id: "tx-18", ref: "TXN-3005", title: "ตลาดสด & ของใช้ในครัว", amount: 1320, type: "expense", categoryId: "food", channel: "เงินสด", date: monthDayIso(0, 5, "17:30:00"), status: "completed" },
  { id: "tx-19", ref: "TXN-3004", title: "ค่าอินเทอร์เน็ต AIS Fibre", amount: 500, type: "expense", categoryId: "housing", channel: "Virtual Bank Wallet", date: monthDayIso(0, 4, "10:00:00"), status: "completed" },
  { id: "tx-20", ref: "TXN-3003", title: "Netflix Premium Ultra HD", amount: 500, type: "expense", categoryId: "entertainment", channel: "Virtual Card", date: monthDayIso(0, 3, "09:30:00"), status: "completed" },
  { id: "tx-21", ref: "TXN-3002", title: "ค่าเช่าคอนโด Ashton Asoke", amount: 12000, type: "expense", categoryId: "housing", channel: "Virtual Bank Wallet", date: monthDayIso(0, 2, "09:15:00"), status: "completed" },
  { id: "tx-22", ref: "INC-3001", title: "เงินเดือนประจำ", amount: 45000, type: "income", categoryId: "salary", channel: "Virtual Bank Wallet", date: monthDayIso(0, 1, "09:00:00"), status: "completed" },

  // --- Previous Month (monthOffset = -1, 11 items: Income 47,800 | Expense 28,700) ---
  { id: "tx-23", ref: "TXN-2011", title: "ซื้อของใช้ร้าน Loft & Uniqlo", amount: 1900, type: "expense", categoryId: "shopping", channel: "Virtual Card", date: monthDayIso(-1, 27, "16:40:00"), status: "completed" },
  { id: "tx-24", ref: "TXN-2010", title: "ค่าทางด่วน & แท็กซี่เดือนก่อน", amount: 1200, type: "expense", categoryId: "transport", channel: "สแกน PromptPay QR", date: monthDayIso(-1, 24, "18:20:00"), status: "completed" },
  { id: "tx-25", ref: "TXN-2009", title: "สังสรรค์ & มื้อเย็นนอกบ้าน", amount: 2800, type: "expense", categoryId: "food", channel: "สแกน PromptPay QR", date: monthDayIso(-1, 21, "20:00:00"), status: "completed" },
  { id: "tx-26", ref: "TXN-2008", title: "คอนเสิร์ต & Netflix เดือนก่อน", amount: 1450, type: "expense", categoryId: "entertainment", channel: "Virtual Card", date: monthDayIso(-1, 18, "14:15:00"), status: "completed" },
  { id: "tx-27", ref: "TXN-2007", title: "ช้อปปิ้งออนไลน์ 11.11", amount: 2900, type: "expense", categoryId: "shopping", channel: "Virtual Card", date: monthDayIso(-1, 15, "21:30:00"), status: "completed" },
  { id: "tx-28", ref: "DIV-2006", title: "เงินปันผลกองทุนรวม K-USXNDQ", amount: 2800, type: "income", categoryId: "investment", channel: "Virtual Bank Wallet", date: monthDayIso(-1, 12, "11:10:00"), status: "completed" },
  { id: "tx-29", ref: "TXN-2005", title: "เติมน้ำมัน & รถไฟฟ้าเดือนก่อน", amount: 1650, type: "expense", categoryId: "transport", channel: "สแกน PromptPay QR", date: monthDayIso(-1, 10, "08:30:00"), status: "completed" },
  { id: "tx-30", ref: "TXN-2004", title: "อาหาร & ซูเปอร์มาร์เก็ตเดือนก่อน", amount: 3400, type: "expense", categoryId: "food", channel: "สแกน PromptPay QR", date: monthDayIso(-1, 8, "18:10:00"), status: "completed" },
  { id: "tx-31", ref: "TXN-2003", title: "ค่าไฟ & ค่าเน็ตเดือนก่อน", amount: 1400, type: "expense", categoryId: "housing", channel: "Virtual Bank Wallet", date: monthDayIso(-1, 5, "10:00:00"), status: "completed" },
  { id: "tx-32", ref: "TXN-2002", title: "ค่าเช่าคอนโด Ashton Asoke", amount: 12000, type: "expense", categoryId: "housing", channel: "Virtual Bank Wallet", date: monthDayIso(-1, 2, "09:15:00"), status: "completed" },
  { id: "tx-33", ref: "INC-2001", title: "เงินเดือนประจำ", amount: 45000, type: "income", categoryId: "salary", channel: "Virtual Bank Wallet", date: monthDayIso(-1, 1, "09:00:00"), status: "completed" },

  // --- 2 Months Ago (monthOffset = -2, 8 items: Income 51,000 | Expense 30,300) ---
  { id: "tx-34", ref: "TXN-1008", title: "ค่าเดินทาง & น้ำมัน 2 เดือนก่อน", amount: 3100, type: "expense", categoryId: "transport", channel: "สแกน PromptPay QR", date: monthDayIso(-2, 25, "17:45:00"), status: "completed" },
  { id: "tx-35", ref: "TXN-1007", title: "เสื้อผ้า & ไลฟ์สไตล์ 2 เดือนก่อน", amount: 5400, type: "expense", categoryId: "shopping", channel: "Virtual Card", date: monthDayIso(-2, 20, "15:30:00"), status: "completed" },
  { id: "tx-36", ref: "TXN-1006", title: "ดูหนัง & สมาชิกสตรีมมิง", amount: 1800, type: "expense", categoryId: "entertainment", channel: "Virtual Card", date: monthDayIso(-2, 16, "19:10:00"), status: "completed" },
  { id: "tx-37", ref: "INC-1005", title: "โบนัสงานโปรเจกต์", amount: 6000, type: "income", categoryId: "salary", channel: "Virtual Bank Wallet", date: monthDayIso(-2, 14, "16:20:00"), status: "completed" },
  { id: "tx-38", ref: "TXN-1004", title: "ค่าอาหาร & เครื่องดื่มทั้งเดือน", amount: 6800, type: "expense", categoryId: "food", channel: "สแกน PromptPay QR", date: monthDayIso(-2, 10, "18:00:00"), status: "completed" },
  { id: "tx-39", ref: "TXN-1003", title: "ค่าน้ำไฟ & อินเทอร์เน็ตคอนโด", amount: 1200, type: "expense", categoryId: "housing", channel: "Virtual Bank Wallet", date: monthDayIso(-2, 5, "10:00:00"), status: "completed" },
  { id: "tx-40", ref: "TXN-1002", title: "ค่าเช่าคอนโด Ashton Asoke", amount: 12000, type: "expense", categoryId: "housing", channel: "Virtual Bank Wallet", date: monthDayIso(-2, 2, "09:15:00"), status: "completed" },
  { id: "tx-41", ref: "INC-1001", title: "เงินเดือนประจำ", amount: 45000, type: "income", categoryId: "salary", channel: "Virtual Bank Wallet", date: monthDayIso(-2, 1, "09:00:00"), status: "completed" },
];

export const INITIAL_TRANSACTIONS: Transaction[] = [...RAW_INITIAL_TRANSACTIONS].sort(
  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
);

export const INITIAL_RECURRING: RecurringPayment[] = [
  { id: "rec-1", title: "Netflix Premium Ultra HD", amount: 500, categoryId: "recurring", cycle: "monthly", nextDueDate: relativeDateYmd(1), active: true, icon: "movie" },
  { id: "rec-2", title: "ค่าเช่าคอนโด Ashton Asoke", amount: 12000, categoryId: "recurring", cycle: "monthly", nextDueDate: relativeDateYmd(3), active: true, icon: "apartment" },
  { id: "rec-salary", title: "เงินเดือนประจำ", amount: 50000, type: "income", categoryId: "salary", cycle: "monthly", nextDueDate: relativeDateYmd(7), active: true, icon: "payments" },
  { id: "rec-3", title: "AIS Fibre 1Gbps + Mobile", amount: 1000, categoryId: "recurring", cycle: "monthly", nextDueDate: relativeDateYmd(10), active: true, icon: "wifi" },
  { id: "rec-4", title: "Spotify Duo", amount: 200, categoryId: "recurring", cycle: "monthly", nextDueDate: relativeDateYmd(15), active: false, icon: "music_note" },
];

function buildInitialLedgerAndBalance(txs: Transaction[]): {
  ledger: BankLedgerEntry[];
  balance: number;
} {
  const chronological = [...txs].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  let runningBalance = 0;
  const entries: BankLedgerEntry[] = chronological.map((tx, idx) => {
    runningBalance =
      tx.type === "income"
        ? runningBalance + tx.amount
        : runningBalance - tx.amount;
    return {
      id: `l-${chronological.length - idx}`,
      ref: `VB-${String(1001 + idx)}`,
      type: tx.type === "income" ? "credit" : "debit",
      title:
        tx.type === "income"
          ? "รับเงินโอนเข้าบัญชี"
          : `ชำระเงิน ${tx.channel}`,
      counterparty: tx.title,
      amount: tx.amount,
      balanceAfter: runningBalance,
      date: tx.date,
    };
  });
  return {
    ledger: entries.reverse(),
    balance: runningBalance,
  };
}

const { ledger: COMPUTED_INITIAL_LEDGER, balance: COMPUTED_INITIAL_BALANCE } =
  buildInitialLedgerAndBalance(INITIAL_TRANSACTIONS);

export const INITIAL_BANK_BALANCE = COMPUTED_INITIAL_BALANCE;

export const INITIAL_LEDGER: BankLedgerEntry[] = COMPUTED_INITIAL_LEDGER;

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

export function isInCurrentQuotaCycle(
  txDate: string,
  quotaResetAt?: string,
  now = new Date()
): boolean {
  const txTime = new Date(txDate).getTime();
  if (Number.isNaN(txTime)) return false;
  if (quotaResetAt) {
    const resetTime = new Date(quotaResetAt).getTime();
    if (!Number.isNaN(resetTime)) {
      return txTime > resetTime;
    }
  }
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return toDateInputValue(txDate).slice(0, 7) === currentYm;
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

export function matchesTransactionDateQuery(
  txDate: string,
  rawQuery: string,
  refDate = new Date()
): boolean {
  const q = String(rawQuery ?? "").trim().toLowerCase();
  if (!q) return false;

  const ymd = toDateInputValue(txDate);
  const [yStr, mStr, dStr] = ymd.split("-");
  const txYear = Number(yStr);
  const txMonth = Number(mStr);
  const txDay = Number(dStr);
  if (!txYear || !txMonth || !txDay) return false;

  // 1. Day-of-month exact match ("16", "06", "วันที่ 16") so "6" won't match "16" or year "2569"
  const dayOnlyMatch = q.match(/^(?:วันที่\s*)?(\d{1,2})$/);
  if (dayOnlyMatch) {
    const targetDay = Number(dayOnlyMatch[1]);
    return targetDay >= 1 && targetDay <= 31 && txDay === targetDay;
  }

  // 2. Day/Month without year ("16/11", "16-11") across any year
  const dmMatch = q.match(/^(\d{1,2})[-/](\d{1,2})$/);
  if (dmMatch) {
    const targetDay = Number(dmMatch[1]);
    const targetMonth = Number(dmMatch[2]);
    return (
      targetDay >= 1 &&
      targetDay <= 31 &&
      targetMonth >= 1 &&
      targetMonth <= 12 &&
      txDay === targetDay &&
      txMonth === targetMonth
    );
  }

  // 3. Pure 3+ digit numbers only match exact 4-digit CE or BE year ("2026", "2569")
  if (/^\d+$/.test(q)) {
    return q.length === 4 && (Number(q) === txYear || Number(q) === txYear + 543);
  }

  // 4. Full dates & relative words ("16/11/2569", "2026-11-16", "วันนี้", "เมื่อวาน")
  const normalized = normalizeTransactionDate(q, refDate);
  if (normalized) {
    return ymd === normalized;
  }

  // 5. Thai textual dates / months ("16 พ.ย.", "06 พ.ย.", "พ.ย.", "พฤศจิกายน", "พ.ย. 2569", "2026-11")
  const dateObj = new Date(`${ymd}T12:00:00+07:00`);
  if (Number.isNaN(dateObj.getTime())) return false;

  const thaiShort = formatThaiDate(ymd).toLowerCase();
  const thaiLong = dateObj
    .toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })
    .toLowerCase();
  const monthShortYear = dateObj
    .toLocaleDateString("th-TH", { month: "short", year: "numeric" })
    .toLowerCase();
  const monthLongYear = dateObj
    .toLocaleDateString("th-TH", { month: "long", year: "numeric" })
    .toLowerCase();

  const cleanText = q.replace(/^วันที่\s*/, "").replace(/\s+/g, " ").trim();
  if (!cleanText) return false;

  if (/^\d/.test(cleanText)) {
    const noLeadingZeroDay = cleanText.replace(/^0(\d)(?=\s|$)/, "$1");
    return (
      thaiShort.startsWith(noLeadingZeroDay) ||
      thaiLong.startsWith(noLeadingZeroDay) ||
      ymd.startsWith(cleanText)
    );
  }

  if (cleanText.length < 2) return false;
  return monthShortYear.startsWith(cleanText) || monthLongYear.startsWith(cleanText);
}
