import type { AppSettings, BankLedgerEntry, RecurringPayment, Transaction } from "./types.ts";
import { INITIAL_SETTINGS, advanceDueDate } from "./seed.ts";

export interface MonthlyRolloverResult {
  simulatedDate: string;
  salaryCredited: number;
  salaryCount: number;
  recurringIncomeCount: number;
  recurringIncomeTotal: number;
  billsPaid: number;
  billsTotal: number;
  billsSkipped: number;
  quotaResetCount: number;
}

export interface RolloverInput {
  targetDate: string;
  bankBalance: number;
  recurring: RecurringPayment[];
  settings: AppSettings;
  nowMs?: number;
}

export interface RolloverOutput {
  result: MonthlyRolloverResult;
  bankBalance: number;
  newTransactions: Transaction[];
  newLedger: BankLedgerEntry[];
  updatedRecurring: RecurringPayment[];
  settingsPatch: Partial<AppSettings>;
}

function clampDayToMonth(year: number, month: number, day: number): string {
  const safeDay = Math.max(1, Math.min(31, Math.floor(day) || 1));
  const lastDay = new Date(year, month, 0).getDate();
  const actualDay = Math.min(safeDay, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(actualDay).padStart(2, "0")}`;
}

function monthRange(startYm: string, endYm: string): Array<{ year: number; month: number; ym: string }> {
  const [sy, sm] = startYm.split("-").map(Number);
  const [ey, em] = endYm.split("-").map(Number);
  if (!sy || !sm || !ey || !em) return [];
  const out: Array<{ year: number; month: number; ym: string }> = [];
  let y = sy;
  let m = sm;
  for (let i = 0; i < 60 && (y < ey || (y === ey && m <= em)); i++) {
    out.push({ year: y, month: m, ym: `${y}-${String(m).padStart(2, "0")}` });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function nextMonthYm(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

type SimEvent =
  | { kind: "quota_reset"; date: string; ym: string; order: 0 }
  | { kind: "salary"; date: string; ym: string; order: 1 }
  | { kind: "recurring_income"; date: string; itemId: string; order: 2 }
  | { kind: "recurring_expense"; date: string; itemId: string; order: 3 };

// Simulates all scheduled financial events chronologically up to targetDate (YYYY-MM-DD).
export function simulateRolloverToDate(input: RolloverInput): RolloverOutput {
  const { targetDate, settings } = input;
  const nowMs = input.nowMs ?? Date.now();
  const salary = Math.max(0, Number(settings.monthlySalary ?? INITIAL_SETTINGS.monthlySalary) || 0);
  const salaryPayday = Math.max(1, Math.min(31, Number(settings.salaryPayday ?? 25) || 25));
  const quotaResetDay = Math.max(1, Math.min(31, Number(settings.quotaResetDay ?? 1) || 1));

  const recurringState = input.recurring.map((r) => ({ ...r }));
  const events: SimEvent[] = [];

  const activeDueDates = recurringState
    .filter((r) => r.active && /^\d{4}-\d{2}-\d{2}$/.test(r.nextDueDate))
    .map((r) => r.nextDueDate)
    .sort();
  const earliestAnchor = [targetDate, ...activeDueDates, settings.lastSimulatedDate]
    .filter((d): d is string => Boolean(d && /^\d{4}-\d{2}-\d{2}$/.test(d)))
    .sort()[0] || targetDate;
  const targetYm = targetDate.slice(0, 7);

  if (salary > 0) {
    const startSalaryYm = settings.lastSalaryMonth
      ? nextMonthYm(settings.lastSalaryMonth)
      : earliestAnchor.slice(0, 7);
    for (const { year, month, ym } of monthRange(startSalaryYm, targetYm)) {
      const payDate = clampDayToMonth(year, month, salaryPayday);
      if (payDate <= targetDate) {
        events.push({ kind: "salary", date: payDate, ym, order: 1 });
      }
    }
  }

  const startResetYm = settings.lastQuotaResetMonth
    ? nextMonthYm(settings.lastQuotaResetMonth)
    : earliestAnchor.slice(0, 7);
  for (const { year, month, ym } of monthRange(startResetYm, targetYm)) {
    const resetDate = clampDayToMonth(year, month, quotaResetDay);
    if (resetDate <= targetDate) {
      events.push({ kind: "quota_reset", date: resetDate, ym, order: 0 });
    }
  }

  // Generate recurring occurrences up to targetDate; actual due-date advancement happens during execution
  // so skipped bills (insufficient balance) stay at their unpaid due date.
  for (const item of recurringState) {
    if (!item.active || !/^\d{4}-\d{2}-\d{2}$/.test(item.nextDueDate)) continue;
    let cursor = item.nextDueDate;
    for (let step = 0; step < 60 && cursor <= targetDate; step++) {
      if ((item.type ?? "expense") === "income") {
        events.push({ kind: "recurring_income", date: cursor, itemId: item.id, order: 2 });
      } else {
        events.push({ kind: "recurring_expense", date: cursor, itemId: item.id, order: 3 });
      }
      const next = advanceDueDate(cursor, item.cycle);
      if (next <= cursor) break;
      cursor = next;
    }
  }

  events.sort((a, b) => (a.date !== b.date ? a.date.localeCompare(b.date) : a.order - b.order));

  let balance = input.bankBalance;
  const newTransactions: Transaction[] = [];
  const newLedger: BankLedgerEntry[] = [];
  const skippedItems = new Set<string>();

  let salaryCredited = 0;
  let salaryCount = 0;
  let recurringIncomeCount = 0;
  let recurringIncomeTotal = 0;
  let billsPaid = 0;
  let billsTotal = 0;
  let billsSkipped = 0;
  let quotaResetCount = 0;
  let lastSalaryMonth = settings.lastSalaryMonth;
  let lastQuotaResetMonth = settings.lastQuotaResetMonth;
  let quotaResetAt = settings.quotaResetAt;

  events.forEach((ev, idx) => {
    const suffix = `${nowMs}-${idx}`;
    if (ev.kind === "quota_reset") {
      quotaResetAt = `${ev.date}T00:00:00+07:00`;
      lastQuotaResetMonth = ev.ym;
      quotaResetCount += 1;
      return;
    }

    if (ev.kind === "salary") {
      balance += salary;
      salaryCredited += salary;
      salaryCount += 1;
      lastSalaryMonth = ev.ym;
      const ref = `PAY-${String(nowMs).slice(-6)}-${idx + 1}`;
      const txDate = `${ev.date}T09:00:00+07:00`;
      newTransactions.push({
        id: `tx-pay-${suffix}`,
        ref,
        title: "เงินเดือนประจำรอบเดือน",
        amount: salary,
        type: "income",
        categoryId: "salary",
        channel: "Virtual Bank Auto-Credit",
        date: txDate,
        status: "completed",
      });
      newLedger.push({
        id: `l-pay-${suffix}`,
        ref,
        type: "credit",
        title: "เงินเดือนโอนเข้าบัญชีอัตโนมัติ",
        counterparty: "Payroll Auto-Credit",
        amount: salary,
        balanceAfter: balance,
        date: txDate,
      });
      return;
    }

    const item = recurringState.find((r) => r.id === ev.itemId);
    if (!item) return;

    if (ev.kind === "recurring_income") {
      balance += item.amount;
      recurringIncomeCount += 1;
      recurringIncomeTotal += item.amount;
      item.nextDueDate = advanceDueDate(ev.date, item.cycle);
      const ref = `INC-${String(nowMs).slice(-6)}-${idx + 1}`;
      const txDate = `${ev.date}T09:05:00+07:00`;
      newTransactions.push({
        id: `tx-inc-${suffix}`,
        ref,
        title: item.title,
        amount: item.amount,
        type: "income",
        categoryId: item.categoryId || "salary",
        channel: "Virtual Bank Auto-Credit",
        date: txDate,
        status: "completed",
      });
      newLedger.push({
        id: `l-inc-${suffix}`,
        ref,
        type: "credit",
        title: `รับรายรับประจำอัตโนมัติ: ${item.title}`,
        counterparty: item.title,
        amount: item.amount,
        balanceAfter: balance,
        date: txDate,
      });
      return;
    }

    if (skippedItems.has(item.id)) return;
    if (balance < item.amount) {
      billsSkipped += 1;
      skippedItems.add(item.id);
      return;
    }

    balance -= item.amount;
    billsPaid += 1;
    billsTotal += item.amount;
    item.nextDueDate = advanceDueDate(ev.date, item.cycle);
    const ref = `REC-${String(nowMs).slice(-6)}-${idx + 1}`;
    const txDate = `${ev.date}T09:10:00+07:00`;
    newTransactions.push({
      id: `tx-rec-${suffix}`,
      ref,
      title: item.title,
      amount: item.amount,
      type: "expense",
      categoryId: item.categoryId,
      channel: "Virtual Bank Auto-Debit",
      date: txDate,
      status: "completed",
    });
    newLedger.push({
      id: `l-rec-${suffix}`,
      ref,
      type: "debit",
      title: `หักบัญชีอัตโนมัติ: ${item.title}`,
      counterparty: item.title,
      amount: item.amount,
      balanceAfter: balance,
      date: txDate,
    });
  });

  const nextSimulatedDate =
    settings.lastSimulatedDate && settings.lastSimulatedDate > targetDate
      ? settings.lastSimulatedDate
      : targetDate;

  return {
    result: {
      simulatedDate: targetDate,
      salaryCredited,
      salaryCount,
      recurringIncomeCount,
      recurringIncomeTotal,
      billsPaid,
      billsTotal,
      billsSkipped,
      quotaResetCount,
    },
    bankBalance: balance,
    newTransactions: newTransactions.reverse(),
    newLedger: newLedger.reverse(),
    updatedRecurring: recurringState,
    settingsPatch: {
      quotaResetAt,
      lastSalaryMonth,
      lastQuotaResetMonth,
      lastSimulatedDate: nextSimulatedDate,
    },
  };
}
