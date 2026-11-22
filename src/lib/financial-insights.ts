import {
  formatTHB,
  isInCurrentQuotaCycle,
  roundCurrency,
  toDateInputValue,
} from "./seed.ts";
import type { Category, RecurringPayment, Transaction, TransactionType } from "./types.ts";

export interface FinancialInsightsInput {
  bankBalance: number;
  transactions: Transaction[];
  categories: Category[];
  recurring: RecurringPayment[];
  quotaResetAt?: string;
  referenceDate?: Date;
  topN?: number;
}

export type BudgetPaceStatus =
  | "no_budget"
  | "over"
  | "near"
  | "ahead_of_pace"
  | "on_track";

export interface CategoryInsight {
  categoryId: string;
  name: string;
  spent: number;
  previousSpent: number;
  momChangePct: number | null;
  budget: number;
  usagePct: number | null;
  remainingBudget: number;
  overBudgetAmount: number;
  shareOfExpensePct: number;
  paceStatus: BudgetPaceStatus;
}

export interface TopTransactionInsight {
  id: string;
  title: string;
  amount: number;
  categoryId: string;
  categoryName: string;
  date: string;
}

export interface SavingsOpportunityItem {
  categoryId: string;
  categoryName: string;
  currentSpent: number;
  targetReductionPct: number;
  potentialMonthlySavings: number;
  reason: string;
}

export interface FinancialInsightsResult {
  monthProgress: {
    dayOfMonth: number;
    daysInMonth: number;
    daysRemaining: number;
    elapsedPct: number;
  };
  periodTotals: {
    currentIncome: number;
    currentExpense: number;
    currentNet: number;
    previousIncome: number;
    previousExpense: number;
    previousNet: number;
    incomeChangePct: number | null;
    expenseChangePct: number | null;
    netChangePct: number | null;
  };
  savings: {
    savingsRatePct: number | null;
    totalBudget: number;
    totalBudgetedSpent: number;
    remainingBudgetTotal: number;
    dailySafeSpendFromBudget: number | null;
    dailySafeSpendFromWallet: number;
  };
  recurringLoad: {
    activeRecurringExpenseMonthly: number;
    activeRecurringIncomeMonthly: number;
    baselineIncome: number;
    recurringLoadPct: number | null;
  };
  categoryInsights: CategoryInsight[];
  topExpenseCategories: CategoryInsight[];
  overBudgetCategories: CategoryInsight[];
  nearBudgetCategories: CategoryInsight[];
  aheadOfPaceCategories: CategoryInsight[];
  spendingAnomalies: CategoryInsight[];
  topTransactions: TopTransactionInsight[];
  savingsOpportunities: SavingsOpportunityItem[];
  totalPotentialMonthlySavings: number;
  savingsDisclaimer: string;
  riskFlags: string[];
}

const SAVINGS_DISCLAIMER = "เป็นเป้าหมายจำลองจากยอดใช้จ่าย ไม่ใช่เงินออมที่เกิดขึ้นจริง";
const DISCRETIONARY_CATEGORY_IDS = new Set(["shopping", "entertainment"]);

function round1(val: number): number {
  return Math.round((val + Number.EPSILON) * 10) / 10;
}

function calcMomChangePct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return round1(((current - previous) / Math.abs(previous)) * 100);
}

function toMonthlyRecurringAmount(item: RecurringPayment): number {
  if (item.cycle === "yearly") return item.amount / 12;
  if (item.cycle === "weekly") return item.amount * 4;
  return item.amount;
}

function sumActiveRecurringMonthly(
  recurring: RecurringPayment[],
  targetType: TransactionType
): number {
  return roundCurrency(
    recurring
      .filter((r) => r.active && (r.type ?? "expense") === targetType)
      .reduce((sum, r) => sum + toMonthlyRecurringAmount(r), 0)
  );
}

function resolvePaceStatus(
  budget: number,
  usagePct: number | null,
  elapsedPct: number
): BudgetPaceStatus {
  if (budget <= 0 || usagePct === null) return "no_budget";
  if (usagePct >= 100) return "over";
  if (usagePct >= 80) return "near";
  if (usagePct > elapsedPct + 15) return "ahead_of_pace";
  return "on_track";
}

function selectSavingsOpportunities(
  categoryInsights: CategoryInsight[]
): SavingsOpportunityItem[] {
  const withSpend = categoryInsights.filter((c) => c.spent > 0);
  if (withSpend.length === 0) return [];

  const nonHousing = withSpend.filter((c) => c.categoryId !== "housing");
  const housing = withSpend.filter((c) => c.categoryId === "housing");

  const priorityRank = (c: CategoryInsight): number => {
    if (c.paceStatus === "over") return 0;
    if (c.paceStatus === "near") return 1;
    if (DISCRETIONARY_CATEGORY_IDS.has(c.categoryId)) return 2;
    if (c.paceStatus === "ahead_of_pace") return 3;
    return 4;
  };

  const ordered = [
    ...[...nonHousing].sort((a, b) => {
      const rankDiff = priorityRank(a) - priorityRank(b);
      return rankDiff !== 0 ? rankDiff : b.spent - a.spent;
    }),
    ...housing,
  ].slice(0, 3);

  return ordered
    .map((c) => {
      const highCut =
        DISCRETIONARY_CATEGORY_IDS.has(c.categoryId) ||
        c.paceStatus === "over" ||
        c.paceStatus === "near";
      const targetReductionPct = highCut ? 15 : 10;
      const potentialMonthlySavings = roundCurrency(
        c.spent * (targetReductionPct / 100)
      );
      const reason =
        c.paceStatus === "over"
          ? "ใช้จ่ายเกินงบที่ตั้งไว้แล้ว"
          : c.paceStatus === "near"
            ? "ใช้จ่ายใกล้เต็มงบประมาณแล้ว"
            : DISCRETIONARY_CATEGORY_IDS.has(c.categoryId)
              ? "เป็นรายจ่ายยืดหยุ่นที่ปรับลดได้ง่ายโดยกระทบชีวิตประจำวันน้อย"
              : "เป็นหมวดรายจ่ายหลักที่มีโอกาสประหยัดได้";
      return {
        categoryId: c.categoryId,
        categoryName: c.name,
        currentSpent: c.spent,
        targetReductionPct,
        potentialMonthlySavings,
        reason,
      };
    })
    .filter((item) => item.potentialMonthlySavings > 0);
}

/** Computes pre-aggregated MoM, burn-rate, savings, anomaly, and simulation metrics for Finora AI. */
export function computeFinancialInsights(
  input: FinancialInsightsInput
): FinancialInsightsResult {
  const { bankBalance, transactions, categories, recurring, quotaResetAt } = input;
  const ref = input.referenceDate ?? new Date();
  const topN = Math.min(10, Math.max(3, Math.round(input.topN ?? 5)));

  const dayOfMonth = ref.getDate();
  const daysInMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(1, daysInMonth - dayOfMonth + 1);
  const elapsedPct = Math.round((dayOfMonth / daysInMonth) * 100);

  const prevMonthDate = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
  const prevYm = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;

  const currentTxs = transactions.filter((t) =>
    isInCurrentQuotaCycle(t.date, quotaResetAt, ref)
  );
  const prevTxs = transactions.filter(
    (t) => toDateInputValue(t.date).slice(0, 7) === prevYm
  );

  const sumByType = (txs: Transaction[], type: TransactionType): number =>
    roundCurrency(
      txs.filter((t) => t.type === type).reduce((sum, t) => sum + t.amount, 0)
    );

  const currentIncome = sumByType(currentTxs, "income");
  const currentExpense = sumByType(currentTxs, "expense");
  const currentNet = roundCurrency(currentIncome - currentExpense);

  const previousIncome = sumByType(prevTxs, "income");
  const previousExpense = sumByType(prevTxs, "expense");
  const previousNet = roundCurrency(previousIncome - previousExpense);

  const savingsRatePct =
    currentIncome > 0
      ? round1(((currentIncome - currentExpense) / currentIncome) * 100)
      : null;

  const expenseCategories = categories.filter(
    (c) => c.type === "expense" && c.id !== "recurring"
  );

  const currentSpentByCat = new Map<string, number>();
  for (const t of currentTxs) {
    if (t.type === "expense") {
      currentSpentByCat.set(
        t.categoryId,
        (currentSpentByCat.get(t.categoryId) ?? 0) + t.amount
      );
    }
  }

  const prevSpentByCat = new Map<string, number>();
  for (const t of prevTxs) {
    if (t.type === "expense") {
      prevSpentByCat.set(
        t.categoryId,
        (prevSpentByCat.get(t.categoryId) ?? 0) + t.amount
      );
    }
  }

  const categoryInsights: CategoryInsight[] = expenseCategories.map((c) => {
    const spent = roundCurrency(currentSpentByCat.get(c.id) ?? 0);
    const previousSpent = roundCurrency(prevSpentByCat.get(c.id) ?? 0);
    const momChangePct =
      previousSpent > 0
        ? round1(((spent - previousSpent) / previousSpent) * 100)
        : null;
    const usagePct = c.budget > 0 ? Math.round((spent / c.budget) * 100) : null;
    const remainingBudget =
      c.budget > 0 ? Math.max(0, roundCurrency(c.budget - spent)) : 0;
    const overBudgetAmount =
      c.budget > 0 ? Math.max(0, roundCurrency(spent - c.budget)) : 0;
    const shareOfExpensePct =
      currentExpense > 0 ? round1((spent / currentExpense) * 100) : 0;
    const paceStatus = resolvePaceStatus(c.budget, usagePct, elapsedPct);

    return {
      categoryId: c.id,
      name: c.name,
      spent,
      previousSpent,
      momChangePct,
      budget: c.budget,
      usagePct,
      remainingBudget,
      overBudgetAmount,
      shareOfExpensePct,
      paceStatus,
    };
  });

  const budgetedCategories = categoryInsights.filter((c) => c.budget > 0);
  const totalBudget = roundCurrency(
    budgetedCategories.reduce((sum, c) => sum + c.budget, 0)
  );
  const totalBudgetedSpent = roundCurrency(
    budgetedCategories.reduce((sum, c) => sum + c.spent, 0)
  );
  const remainingBudgetTotal = Math.max(
    0,
    roundCurrency(totalBudget - totalBudgetedSpent)
  );
  const dailySafeSpendFromBudget =
    totalBudget > 0 ? roundCurrency(remainingBudgetTotal / daysRemaining) : null;
  const dailySafeSpendFromWallet =
    bankBalance > 0 ? roundCurrency(bankBalance / daysRemaining) : 0;

  const topExpenseCategories = [...categoryInsights]
    .filter((c) => c.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, topN);

  const overBudgetCategories = [...categoryInsights]
    .filter((c) => c.paceStatus === "over")
    .sort((a, b) => b.overBudgetAmount - a.overBudgetAmount);

  const nearBudgetCategories = [...categoryInsights]
    .filter((c) => c.paceStatus === "near")
    .sort((a, b) => (b.usagePct ?? 0) - (a.usagePct ?? 0));

  const aheadOfPaceCategories = [...categoryInsights]
    .filter((c) => c.paceStatus === "ahead_of_pace")
    .sort((a, b) => (b.usagePct ?? 0) - (a.usagePct ?? 0));

  const spendingAnomalies = [...categoryInsights]
    .filter(
      (c) =>
        c.previousSpent > 0 &&
        c.spent > c.previousSpent &&
        c.momChangePct !== null &&
        c.momChangePct >= 20
    )
    .sort((a, b) => b.spent - b.previousSpent - (a.spent - a.previousSpent));

  const activeRecurringExpenseMonthly = sumActiveRecurringMonthly(
    recurring,
    "expense"
  );
  const activeRecurringIncomeMonthly = sumActiveRecurringMonthly(
    recurring,
    "income"
  );
  const baselineIncome = roundCurrency(
    Math.max(currentIncome, activeRecurringIncomeMonthly)
  );
  const recurringLoadPct =
    baselineIncome > 0
      ? round1((activeRecurringExpenseMonthly / baselineIncome) * 100)
      : null;

  const catNameById = new Map(categories.map((c) => [c.id, c.name]));
  const topTransactions: TopTransactionInsight[] = [...currentTxs]
    .filter((t) => t.type === "expense")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, topN)
    .map((t) => ({
      id: t.id,
      title: t.title,
      amount: t.amount,
      categoryId: t.categoryId,
      categoryName: catNameById.get(t.categoryId) || t.categoryId,
      date: t.date,
    }));

  const savingsOpportunities = selectSavingsOpportunities(categoryInsights);
  const totalPotentialMonthlySavings = roundCurrency(
    savingsOpportunities.reduce((sum, item) => sum + item.potentialMonthlySavings, 0)
  );

  const riskFlags: string[] = [];
  if (bankBalance < 0) {
    riskFlags.push(`ยอดเงินคงเหลือ Virtual Wallet ติดลบ (${formatTHB(bankBalance)})`);
  }
  for (const c of overBudgetCategories) {
    riskFlags.push(
      `หมวด "${c.name}" ใช้เกินงบแล้ว (${c.usagePct}% | เกิน ${formatTHB(c.overBudgetAmount)})`
    );
  }
  for (const c of nearBudgetCategories) {
    riskFlags.push(`หมวด "${c.name}" ใกล้เต็มงบแล้ว (${c.usagePct}%)`);
  }
  for (const c of aheadOfPaceCategories) {
    riskFlags.push(
      `หมวด "${c.name}" ใช้เร็วกว่าสัดส่วนเวลาของเดือน (${c.usagePct}% เทียบเวลาผ่านไป ${elapsedPct}%)`
    );
  }
  if (recurringLoadPct !== null && recurringLoadPct >= 50) {
    riskFlags.push(
      `ภาระรายจ่ายประจำ (Recurring) สูงถึง ${recurringLoadPct}% ของรายรับ`
    );
  }

  return {
    monthProgress: {
      dayOfMonth,
      daysInMonth,
      daysRemaining,
      elapsedPct,
    },
    periodTotals: {
      currentIncome,
      currentExpense,
      currentNet,
      previousIncome,
      previousExpense,
      previousNet,
      incomeChangePct: calcMomChangePct(currentIncome, previousIncome),
      expenseChangePct: calcMomChangePct(currentExpense, previousExpense),
      netChangePct: calcMomChangePct(currentNet, previousNet),
    },
    savings: {
      savingsRatePct,
      totalBudget,
      totalBudgetedSpent,
      remainingBudgetTotal,
      dailySafeSpendFromBudget,
      dailySafeSpendFromWallet,
    },
    recurringLoad: {
      activeRecurringExpenseMonthly,
      activeRecurringIncomeMonthly,
      baselineIncome,
      recurringLoadPct,
    },
    categoryInsights,
    topExpenseCategories,
    overBudgetCategories,
    nearBudgetCategories,
    aheadOfPaceCategories,
    spendingAnomalies,
    topTransactions,
    savingsOpportunities,
    totalPotentialMonthlySavings,
    savingsDisclaimer: SAVINGS_DISCLAIMER,
    riskFlags,
  };
}

function formatMomDelta(pct: number | null, label: string): string {
  if (pct === null) return `${label}: ไม่มีข้อมูลเดือนก่อน`;
  const sign = pct > 0 ? "+" : "";
  return `${label}: ${sign}${pct}%`;
}

/** Formats a compact 5-8 line analytics block for system prompt context injection. */
export function formatCompactInsightsForPrompt(
  insights: FinancialInsightsResult
): string {
  const {
    monthProgress,
    periodTotals,
    savings,
    recurringLoad,
    riskFlags,
    savingsOpportunities,
    totalPotentialMonthlySavings,
  } = insights;
  const savingsRateText =
    savings.savingsRatePct !== null ? `${savings.savingsRatePct}%` : "ไม่มีรายรับในรอบนี้";
  const dailySafeText =
    savings.dailySafeSpendFromBudget !== null
      ? `จากงบที่เหลือ ${formatTHB(savings.dailySafeSpendFromBudget)}/วัน | จากยอดกระเป๋า ${formatTHB(savings.dailySafeSpendFromWallet)}/วัน`
      : `จากยอดกระเป๋า ${formatTHB(savings.dailySafeSpendFromWallet)}/วัน (ยังไม่ได้ตั้งงบหมวดหมู่)`;
  const recurringLoadText =
    recurringLoad.recurringLoadPct !== null
      ? `${recurringLoad.recurringLoadPct}% ของรายรับฐาน (${formatTHB(recurringLoad.activeRecurringExpenseMonthly)}/${formatTHB(recurringLoad.baselineIncome)})`
      : `ยังไม่มีรายรับฐานสำหรับเทียบ (รายจ่ายประจำ ${formatTHB(recurringLoad.activeRecurringExpenseMonthly)}/เดือน)`;
  const flagsText = riskFlags.length > 0 ? riskFlags.join(" ; ") : "ไม่มีสัญญาณเสี่ยง";

  const savingsLine =
    savingsOpportunities.length > 0
      ? `- เป้าหมายประหยัดจำลอง (จากยอดรอบปัจจุบัน, ไม่ใช่เงินออมจริง): ${savingsOpportunities
          .map(
            (item) =>
              `ลด "${item.categoryName}" ${item.targetReductionPct}% (${formatTHB(item.potentialMonthlySavings)}/เดือน)`
          )
          .join(", ")} | รวมอาจประหยัดได้ ${formatTHB(totalPotentialMonthlySavings)}/เดือน`
      : null;

  return [
    "สรุปวิเคราะห์เชิงลึก (คำนวณล่วงหน้า):",
    `- ความคืบหน้าของเดือน: วันที่ ${monthProgress.dayOfMonth}/${monthProgress.daysInMonth} (ผ่านไปแล้ว ${monthProgress.elapsedPct}%, เหลือ ${monthProgress.daysRemaining} วัน)`,
    `- กระแสเงินสดรอบนี้: รายรับ ${formatTHB(periodTotals.currentIncome)} | รายจ่าย ${formatTHB(periodTotals.currentExpense)} | สุทธิ ${formatTHB(periodTotals.currentNet)} | อัตราการออม ${savingsRateText}`,
    `- เทียบเดือนก่อน (MoM): ${formatMomDelta(periodTotals.expenseChangePct, "รายจ่าย")} | ${formatMomDelta(periodTotals.incomeChangePct, "รายรับ")}`,
    `- งบใช้ได้ปลอดภัยต่อวัน (Daily Safe Spend): ${dailySafeText}`,
    `- ภาระรายจ่ายประจำ (Recurring Load): ${recurringLoadText}`,
    `- สัญญาณเตือนความเสี่ยง: ${flagsText}`,
    ...(savingsLine ? [savingsLine] : []),
  ].join("\n");
}
