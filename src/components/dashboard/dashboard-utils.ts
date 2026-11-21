import type { AppSettings, Category, RecurringPayment, Transaction } from "@/lib/types";
import { formatTHB, formatThaiDate, isInCurrentQuotaCycle, toDateInputValue } from "@/lib/seed";

export type DatePreset =
  | "this_month"
  | "last_7_days"
  | "last_30_days"
  | "this_year"
  | "all_time"
  | "custom";

export type ChartGranularity = "monthly" | "weekly" | "yearly";

export interface DateRange {
  preset: DatePreset;
  startYmd: string;
  endYmd: string;
  label: string;
  shortRangeLabel: string;
}

export interface PeriodSummary {
  income: number;
  expense: number;
  net: number;
  savingsRate: number;
  incomeCount: number;
  expenseCount: number;
  prevIncome: number;
  prevExpense: number;
  prevNet: number;
  incomePctChange: number | null;
  expensePctChange: number | null;
  netPctChange: number | null;
  hasPrevPeriod: boolean;
}

export interface SparklineSeries {
  incomeSeries: number[];
  expenseSeries: number[];
  netSeries: number[];
}

export interface BarBucket {
  key: string;
  label: string;
  fullLabel: string;
  income: number;
  expense: number;
  net: number;
}

export interface BudgetCategoryItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  budget: number;
  spent: number;
  remaining: number;
  pct: number;
  over: boolean;
}

export interface BudgetOverviewSummary {
  items: BudgetCategoryItem[];
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  usedPct: number;
  hasBudgets: boolean;
  cycleLabel: string;
}

export interface ExpenseSlice {
  id: string;
  name: string;
  icon: string;
  color: string;
  amount: number;
  pct: number;
}

export interface ExpenseBreakdownSummary {
  totalExpense: number;
  slices: ExpenseSlice[];
}

export interface DashboardInsight {
  headline: string;
  detail: string;
  secondary: string;
  tone: "positive" | "warning" | "neutral";
}

export interface DashboardNotification {
  id: string;
  kind: "budget" | "bill";
  severity: "warning" | "danger" | "info";
  title: string;
  description: string;
  href: string;
}

export const THAI_MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

const THAI_WEEKDAYS_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function localDateToYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseYmdLocal(ymd: string): Date | null {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(y, mo - 1, day);
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== day) return null;
  return d;
}

function addDays(d: Date, offset: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);
}

function formatThaiRangeShort(startYmd: string, endYmd: string): string {
  const s = parseYmdLocal(startYmd);
  const e = parseYmdLocal(endYmd);
  if (!s || !e) return "";
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${s.getDate()} – ${e.getDate()} ${THAI_MONTHS_SHORT[s.getMonth()]} ${s.getFullYear() + 543}`;
  }
  return `${formatThaiDate(startYmd)} – ${formatThaiDate(endYmd)}`;
}

export function getThaiGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "สวัสดีตอนเช้า";
  if (hour >= 12 && hour < 17) return "สวัสดีตอนบ่าย";
  if (hour >= 17 && hour < 21) return "สวัสดีตอนเย็น";
  return "สวัสดีตอนค่ำ";
}

export function formatCompactTHB(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    return `${sign}฿${(abs / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (abs >= 10_000) {
    return `${sign}฿${(abs / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  if (abs === 0) return "฿0";
  return `${sign}฿${Math.round(abs).toLocaleString("en-US")}`;
}

export function resolveDateRange(
  preset: DatePreset,
  customStart?: string,
  customEnd?: string,
  now = new Date()
): DateRange {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStr = localDateToYmd(today);

  if (preset === "last_7_days") {
    const startStr = localDateToYmd(addDays(today, -6));
    return {
      preset,
      startYmd: startStr,
      endYmd: todayStr,
      label: "7 วันที่ผ่านมา",
      shortRangeLabel: formatThaiRangeShort(startStr, todayStr),
    };
  }

  if (preset === "last_30_days") {
    const startStr = localDateToYmd(addDays(today, -29));
    return {
      preset,
      startYmd: startStr,
      endYmd: todayStr,
      label: "30 วันที่ผ่านมา",
      shortRangeLabel: formatThaiRangeShort(startStr, todayStr),
    };
  }

  if (preset === "this_year") {
    const startStr = `${today.getFullYear()}-01-01`;
    const endStr = `${today.getFullYear()}-12-31`;
    return {
      preset,
      startYmd: startStr,
      endYmd: endStr,
      label: "ปีนี้",
      shortRangeLabel: `1 ม.ค. – 31 ธ.ค. ${today.getFullYear() + 543}`,
    };
  }

  if (preset === "all_time") {
    return {
      preset,
      startYmd: "",
      endYmd: "",
      label: "ทั้งหมด",
      shortRangeLabel: "ทุกรายการในระบบ",
    };
  }

  if (preset === "custom" && customStart && customEnd) {
    const s = parseYmdLocal(customStart);
    const e = parseYmdLocal(customEnd);
    if (s && e) {
      const startYmd = customStart <= customEnd ? customStart : customEnd;
      const endYmd = customStart <= customEnd ? customEnd : customStart;
      return {
        preset: "custom",
        startYmd,
        endYmd,
        label: "กำหนดเอง",
        shortRangeLabel: formatThaiRangeShort(startYmd, endYmd),
      };
    }
  }

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const startYmd = localDateToYmd(monthStart);
  const endYmd = localDateToYmd(monthEnd);
  return {
    preset: "this_month",
    startYmd,
    endYmd,
    label: "เดือนนี้",
    shortRangeLabel: formatThaiRangeShort(startYmd, endYmd),
  };
}

export function getPreviousDateRange(
  range: DateRange
): { startYmd: string; endYmd: string } | null {
  if (range.preset === "all_time" || !range.startYmd || !range.endYmd) return null;

  const start = parseYmdLocal(range.startYmd);
  const end = parseYmdLocal(range.endYmd);
  if (!start || !end) return null;

  if (range.preset === "this_month") {
    const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
    const prevEnd = new Date(start.getFullYear(), start.getMonth(), 0);
    return { startYmd: localDateToYmd(prevStart), endYmd: localDateToYmd(prevEnd) };
  }

  if (range.preset === "this_year") {
    const prevYear = start.getFullYear() - 1;
    return { startYmd: `${prevYear}-01-01`, endYmd: `${prevYear}-12-31` };
  }

  const spanDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -spanDays);
  return { startYmd: localDateToYmd(prevStart), endYmd: localDateToYmd(prevEnd) };
}

export function filterTransactionsByRange(
  transactions: Transaction[],
  startYmd: string,
  endYmd: string
): Transaction[] {
  if (!startYmd && !endYmd) return transactions;
  return transactions.filter((tx) => {
    const d = toDateInputValue(tx.date);
    if (startYmd && d < startYmd) return false;
    if (endYmd && d > endYmd) return false;
    return true;
  });
}

function calcPctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

export function computePeriodSummary(
  transactions: Transaction[],
  range: DateRange
): PeriodSummary {
  const currentTx = filterTransactionsByRange(transactions, range.startYmd, range.endYmd);
  let income = 0;
  let expense = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  for (const tx of currentTx) {
    if (tx.type === "income") {
      income += tx.amount;
      incomeCount += 1;
    } else {
      expense += tx.amount;
      expenseCount += 1;
    }
  }

  const net = income - expense;
  const savingsRate = income > 0 ? Math.max(0, Math.round((net / income) * 100)) : 0;

  const prevRange = getPreviousDateRange(range);
  let prevIncome = 0;
  let prevExpense = 0;

  if (prevRange) {
    const prevTx = filterTransactionsByRange(transactions, prevRange.startYmd, prevRange.endYmd);
    for (const tx of prevTx) {
      if (tx.type === "income") prevIncome += tx.amount;
      else prevExpense += tx.amount;
    }
  }

  const prevNet = prevIncome - prevExpense;

  return {
    income,
    expense,
    net,
    savingsRate,
    incomeCount,
    expenseCount,
    prevIncome,
    prevExpense,
    prevNet,
    incomePctChange: prevRange ? calcPctChange(income, prevIncome) : null,
    expensePctChange: prevRange ? calcPctChange(expense, prevExpense) : null,
    netPctChange: prevRange ? calcPctChange(net, prevNet) : null,
    hasPrevPeriod: prevRange !== null,
  };
}

export function buildSparklineSeries(
  transactions: Transaction[],
  range: DateRange,
  now = new Date()
): SparklineSeries {
  const filtered = filterTransactionsByRange(transactions, range.startYmd, range.endYmd);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayYmd = localDateToYmd(today);

  if (range.preset === "all_time") {
    const months: Array<{ ym: string; income: number; expense: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push({ ym: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`, income: 0, expense: 0 });
    }
    for (const tx of filtered) {
      const ym = toDateInputValue(tx.date).slice(0, 7);
      const bucket = months.find((m) => m.ym === ym);
      if (bucket) {
        if (tx.type === "income") bucket.income += tx.amount;
        else bucket.expense += tx.amount;
      }
    }
    let runningNet = 0;
    return {
      incomeSeries: months.map((m) => m.income),
      expenseSeries: months.map((m) => m.expense),
      netSeries: months.map((m) => {
        runningNet += m.income - m.expense;
        return runningNet;
      }),
    };
  }

  if (range.preset === "this_year" && today.getMonth() >= 1) {
    const months: Array<{ ym: string; income: number; expense: number }> = [];
    for (let m = 0; m <= today.getMonth(); m++) {
      months.push({ ym: `${today.getFullYear()}-${pad2(m + 1)}`, income: 0, expense: 0 });
    }
    for (const tx of filtered) {
      const ym = toDateInputValue(tx.date).slice(0, 7);
      const bucket = months.find((b) => b.ym === ym);
      if (bucket) {
        if (tx.type === "income") bucket.income += tx.amount;
        else bucket.expense += tx.amount;
      }
    }
    let runningNet = 0;
    return {
      incomeSeries: months.map((m) => m.income),
      expenseSeries: months.map((m) => m.expense),
      netSeries: months.map((m) => {
        runningNet += m.income - m.expense;
        return runningNet;
      }),
    };
  }

  const startDate = parseYmdLocal(range.startYmd) ?? addDays(today, -6);
  const rawEndDate = parseYmdLocal(range.endYmd) ?? today;
  const effectiveEndYmd =
    range.preset !== "custom" && range.startYmd <= todayYmd && range.endYmd > todayYmd
      ? todayYmd
      : localDateToYmd(rawEndDate);
  const endDate = parseYmdLocal(effectiveEndYmd) ?? rawEndDate;

  const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1);
  const bucketCount = range.preset === "last_7_days" ? 7 : Math.min(8, Math.max(4, totalDays));

  const buckets = Array.from({ length: bucketCount }, () => ({ income: 0, expense: 0 }));
  for (const tx of filtered) {
    const d = parseYmdLocal(toDateInputValue(tx.date));
    if (!d) continue;
    const dayOffset = Math.max(
      0,
      Math.min(totalDays - 1, Math.round((d.getTime() - startDate.getTime()) / 86_400_000))
    );
    const idx = Math.min(bucketCount - 1, Math.floor((dayOffset / totalDays) * bucketCount));
    if (tx.type === "income") buckets[idx].income += tx.amount;
    else buckets[idx].expense += tx.amount;
  }

  let runningNet = 0;
  return {
    incomeSeries: buckets.map((b) => b.income),
    expenseSeries: buckets.map((b) => b.expense),
    netSeries: buckets.map((b) => {
      runningNet += b.income - b.expense;
      return runningNet;
    }),
  };
}

export function buildBarChartSeries(
  transactions: Transaction[],
  granularity: ChartGranularity,
  anchorYmd?: string,
  now = new Date()
): BarBucket[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const parsedAnchor = anchorYmd ? parseYmdLocal(anchorYmd) : null;
  const anchor = parsedAnchor ?? today;

  if (granularity === "weekly") {
    const buckets: BarBucket[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(anchor, -i);
      const ymd = localDateToYmd(d);
      buckets.push({
        key: ymd,
        label: `${THAI_WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()}`,
        fullLabel: formatThaiDate(ymd),
        income: 0,
        expense: 0,
        net: 0,
      });
    }
    const map = new Map(buckets.map((b) => [b.key, b]));
    for (const tx of transactions) {
      const b = map.get(toDateInputValue(tx.date));
      if (!b) continue;
      if (tx.type === "income") b.income += tx.amount;
      else b.expense += tx.amount;
    }
    for (const b of buckets) b.net = b.income - b.expense;
    return buckets;
  }

  if (granularity === "yearly") {
    const endYear = anchor.getFullYear();
    const buckets: BarBucket[] = [];
    for (let y = endYear - 3; y <= endYear; y++) {
      const be = y + 543;
      buckets.push({
        key: String(y),
        label: String(be),
        fullLabel: `ปี ${be}`,
        income: 0,
        expense: 0,
        net: 0,
      });
    }
    const map = new Map(buckets.map((b) => [b.key, b]));
    for (const tx of transactions) {
      const b = map.get(toDateInputValue(tx.date).slice(0, 4));
      if (!b) continue;
      if (tx.type === "income") b.income += tx.amount;
      else b.expense += tx.amount;
    }
    for (const b of buckets) b.net = b.income - b.expense;
    return buckets;
  }

  // Monthly (last 6 calendar months ending with anchor month)
  const buckets: BarBucket[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    const monthLabel = THAI_MONTHS_SHORT[d.getMonth()];
    buckets.push({
      key,
      label: monthLabel,
      fullLabel: `${monthLabel} ${d.getFullYear() + 543}`,
      income: 0,
      expense: 0,
      net: 0,
    });
  }
  const map = new Map(buckets.map((b) => [b.key, b]));
  for (const tx of transactions) {
    const b = map.get(toDateInputValue(tx.date).slice(0, 7));
    if (!b) continue;
    if (tx.type === "income") b.income += tx.amount;
    else b.expense += tx.amount;
  }
  for (const b of buckets) b.net = b.income - b.expense;
  return buckets;
}

export function computeBudgetOverview(
  categories: Category[],
  transactions: Transaction[],
  quotaResetAt?: string,
  now = new Date()
): BudgetOverviewSummary {
  const budgetedCats = categories.filter(
    (c) => c.type === "expense" && c.id !== "recurring" && c.budget > 0
  );

  const items: BudgetCategoryItem[] = budgetedCats
    .map((cat) => {
      const spent = transactions
        .filter(
          (t) =>
            t.type === "expense" &&
            t.categoryId === cat.id &&
            isInCurrentQuotaCycle(t.date, quotaResetAt, now)
        )
        .reduce((s, t) => s + t.amount, 0);
      const pct = cat.budget > 0 ? Math.round((spent / cat.budget) * 100) : 0;
      return {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        budget: cat.budget,
        spent,
        remaining: cat.budget - spent,
        pct,
        over: spent > cat.budget,
      };
    })
    .sort((a, b) => b.pct - a.pct || b.spent - a.spent);

  const totalBudget = items.reduce((s, i) => s + i.budget, 0);
  const totalSpent = items.reduce((s, i) => s + i.spent, 0);
  const totalRemaining = totalBudget - totalSpent;
  const usedPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const hasValidReset = Boolean(quotaResetAt && !Number.isNaN(new Date(quotaResetAt).getTime()));

  return {
    items,
    totalBudget,
    totalSpent,
    totalRemaining,
    usedPct,
    hasBudgets: totalBudget > 0,
    cycleLabel: hasValidReset ? "รอบงบปัจจุบัน" : "เดือนนี้",
  };
}

export function computeExpenseBreakdown(
  filteredTransactions: Transaction[],
  categories: Category[]
): ExpenseBreakdownSummary {
  const expenseTx = filteredTransactions.filter((t) => t.type === "expense");
  const totalExpense = expenseTx.reduce((s, t) => s + t.amount, 0);
  if (totalExpense <= 0) {
    return { totalExpense: 0, slices: [] };
  }

  const totalsByCat = new Map<string, number>();
  for (const tx of expenseTx) {
    totalsByCat.set(tx.categoryId, (totalsByCat.get(tx.categoryId) || 0) + tx.amount);
  }

  const slices: ExpenseSlice[] = Array.from(totalsByCat.entries())
    .map(([categoryId, amount]) => {
      const cat = categories.find((c) => c.id === categoryId);
      return {
        id: categoryId,
        name: cat?.name || categoryId,
        icon: cat?.icon || "label",
        color: cat?.color || "#64748B",
        amount,
        pct: Math.round((amount / totalExpense) * 100),
      };
    })
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return { totalExpense, slices };
}

export function buildDashboardInsights(params: {
  summary: PeriodSummary;
  budgetSummary: BudgetOverviewSummary;
  breakdown: ExpenseBreakdownSummary;
  recurring: RecurringPayment[];
  bankBalance: number;
  range: DateRange;
  totalTxCount: number;
}): DashboardInsight {
  const { summary, budgetSummary, breakdown, recurring, bankBalance, range, totalTxCount } =
    params;

  if (totalTxCount === 0) {
    return {
      tone: "neutral",
      headline: "เริ่มต้นบันทึกธุรกรรมแรกของคุณ",
      detail:
        "ยังไม่มีรายการรายรับ-รายจ่ายในระบบ คุณสามารถเพิ่มรายการหรือส่งรูปสลิปให้ Finora AI ช่วยบันทึกอัตโนมัติได้ทันที",
      secondary: `ยอด Virtual Wallet ปัจจุบัน: ${formatTHB(bankBalance)}`,
    };
  }

  const overBudgetCat = budgetSummary.items.find((c) => c.over);
  const nearBudgetCat = budgetSummary.items.find((c) => !c.over && c.pct >= 80);
  const topSlice = breakdown.slices[0];

  let tone: DashboardInsight["tone"] = "positive";
  let headline = "สุขภาพการเงินอยู่ในเกณฑ์สมดุล";
  let detail = "";

  if (overBudgetCat) {
    tone = "warning";
    headline = `หมวด "${overBudgetCat.name}" ใช้จ่ายเกินงบแล้ว (${overBudgetCat.pct}%)`;
    detail = `ใช้ไป ${formatTHB(overBudgetCat.spent)} จากงบ ${formatTHB(overBudgetCat.budget)} (เกิน ${formatTHB(Math.abs(overBudgetCat.remaining))}) แนะนำให้ชะลอรายจ่ายหมวดนี้ในรอบปัจจุบัน`;
  } else if (nearBudgetCat) {
    tone = "warning";
    headline = `หมวด "${nearBudgetCat.name}" ใกล้เต็มงบแล้ว (${nearBudgetCat.pct}%)`;
    detail = `เหลืองบอีก ${formatTHB(nearBudgetCat.remaining)} จากเพดาน ${formatTHB(nearBudgetCat.budget)} เพื่อไม่ให้บานปลายช่วงปลายเดือน`;
  } else if (
    summary.hasPrevPeriod &&
    summary.expensePctChange !== null &&
    summary.expensePctChange > 10 &&
    topSlice
  ) {
    tone = "warning";
    headline = `รายจ่าย${range.label}เพิ่มขึ้น +${summary.expensePctChange}% จากช่วงก่อน`;
    detail = `หมวดที่ใช้จ่ายสูงสุดคือ "${topSlice.name}" (${formatTHB(topSlice.amount)} หรือ ${topSlice.pct}% ของรายจ่ายช่วงนี้)`;
  } else if (topSlice) {
    tone = summary.net >= 0 ? "positive" : "warning";
    headline = `ค่าใช้จ่ายหลักอยู่ในหมวด "${topSlice.name}" (${topSlice.pct}%)`;
    detail =
      summary.net >= 0
        ? `ยอดใช้จ่ายหมวดนี้อยู่ที่ ${formatTHB(topSlice.amount)} และคุณยังคงมีเงินออมสุทธิ ${formatTHB(summary.net)} (${summary.savingsRate}% ของรายรับ)`
        : `ยอดใช้จ่ายหมวดนี้อยู่ที่ ${formatTHB(topSlice.amount)} ส่งผลให้กระแสเงินสดช่วงนี้ติดลบ ${formatTHB(summary.net)}`;
  } else {
    tone = summary.net >= 0 ? "positive" : "neutral";
    headline =
      summary.income > 0
        ? `ช่วง${range.label}มีรายรับรวม ${formatTHB(summary.income)}`
        : `ไม่มีรายจ่ายในช่วง${range.label}`;
    detail = `กระแสเงินสดสุทธิอยู่ที่ ${formatTHB(summary.net)} พร้อมอัตราการออม ${summary.savingsRate}%`;
  }

  const activeRecurringExpense = recurring
    .filter((r) => r.active && (r.type ?? "expense") === "expense")
    .reduce((s, r) => s + (r.cycle === "yearly" ? r.amount / 12 : r.amount), 0);

  const secondary =
    activeRecurringExpense > 0
      ? `ภาระรายจ่ายประจำเฉลี่ย ${formatTHB(activeRecurringExpense)}/เดือน • Virtual Wallet คงเหลือ ${formatTHB(bankBalance)}`
      : `Virtual Wallet คงเหลือ ${formatTHB(bankBalance)}`;

  return { tone, headline, detail, secondary };
}

export function buildDashboardNotifications(
  categories: Category[],
  transactions: Transaction[],
  recurring: RecurringPayment[],
  settings: AppSettings,
  now = new Date()
): DashboardNotification[] {
  const alerts: DashboardNotification[] = [];

  if (settings.notifyBudget80) {
    const budgetSummary = computeBudgetOverview(categories, transactions, settings.quotaResetAt, now);
    for (const cat of budgetSummary.items) {
      if (cat.pct >= 80) {
        alerts.push({
          id: `budget-${cat.id}`,
          kind: "budget",
          severity: cat.over ? "danger" : "warning",
          title: cat.over
            ? `หมวด "${cat.name}" เกินงบแล้ว (${cat.pct}%)`
            : `หมวด "${cat.name}" ใช้ไปแล้ว ${cat.pct}% ของงบ`,
          description: `${formatTHB(cat.spent)} / ${formatTHB(cat.budget)}`,
          href: "/categories",
        });
      }
    }
  }

  if (settings.notifyUpcomingBills) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayYmd = localDateToYmd(today);
    const soonYmd = localDateToYmd(addDays(today, 7));

    for (const item of recurring) {
      if (!item.active || (item.type ?? "expense") !== "expense") continue;
      if (item.nextDueDate && item.nextDueDate <= soonYmd) {
        const overdue = item.nextDueDate < todayYmd;
        alerts.push({
          id: `bill-${item.id}`,
          kind: "bill",
          severity: overdue ? "danger" : "info",
          title: overdue ? `ครบกำหนดชำระแล้ว: ${item.title}` : `บิลใกล้ครบกำหนด: ${item.title}`,
          description: `${formatTHB(item.amount)} • ${formatThaiDate(item.nextDueDate)}`,
          href: "/recurring",
        });
      }
    }
  }

  return alerts;
}
