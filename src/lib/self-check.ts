import assert from "node:assert/strict";
import { executeBankTransfer } from "./bank-service.ts";
import { getToolExecutionPriority, runReadTool, validateAndNormalizeWriteTool } from "./ai-tools.ts";
import { cleanOcrText } from "./ocr.ts";
import { buildQrSlipPrompt, parseQrSlipResult } from "./prompts.ts";
import { simulateRolloverToDate } from "./rollover.ts";
import { CATEGORY_PALETTE, INITIAL_BANK_BALANCE, INITIAL_CATEGORIES, INITIAL_RECURRING, INITIAL_SETTINGS, INITIAL_TRANSACTIONS, formatTHB, formatThaiDate, isBaseCategory, nextCategoryColor, normalizeTransactionDate, parsePromptPayPayload, relativeDateYmd } from "./seed.ts";

// 1. Valid credit increases balance
const topup = executeBankTransfer({ type: "credit", amount: 5000, title: "Topup", counterparty: "SCB" }, 10000);
assert.equal(topup.ok, true);
assert.equal(topup.balance, 15000);
assert.equal(topup.entry?.balanceAfter, 15000);

// 2. Valid debit decreases balance
const pay = executeBankTransfer({ type: "debit", amount: 2500, title: "Coffee", counterparty: "Cafe" }, 10000);
assert.equal(pay.ok, true);
assert.equal(pay.balance, 7500);

// 3. Overdraft debit is allowed so Virtual Wallet balance can go negative
const overdraft = executeBankTransfer({ type: "debit", amount: 20000, title: "Big", counterparty: "Store" }, 10000);
assert.equal(overdraft.ok, true);
assert.equal(overdraft.balance, -10000);
assert.equal(overdraft.entry?.balanceAfter, -10000);

// 4. Non-positive amount is rejected
const invalid = executeBankTransfer({ type: "credit", amount: 0, title: "Zero", counterparty: "Test" }, 10000);
assert.equal(invalid.ok, false);

// 5. Seed categories have unique colors, and new ones skip colors already in use
const seedColors = INITIAL_CATEGORIES.map((c) => c.color);
assert.equal(new Set(seedColors).size, seedColors.length);
assert.equal(nextCategoryColor([...seedColors, CATEGORY_PALETTE[0]]), CATEGORY_PALETTE[1]);

// 6. Base categories are protected while custom ones can be removed
assert.equal(isBaseCategory("food"), true);
assert.equal(isBaseCategory("cat-12345"), false);

// 7. PromptPay TLV parser extracts merchant, formatted Thai phone ID, and amount
const parsedQr = parsePromptPayPayload("00020129370016A000000677010111011300668123456785406185.005909Starbucks");
assert.equal(parsedQr.amount, 185);
assert.equal(parsedQr.merchant, "Starbucks");
assert.equal(parsedQr.promptPayId, "0812345678");
assert.equal(parsedQr.isPromptPayOrSlip, true);

// 8. AI read tools return real transaction data and deterministic prediction with assumptions
const txRes = runReadTool("get_transactions", { type: "expense", limit: 2 }, {
  bankBalance: 100000,
  transactions: INITIAL_TRANSACTIONS,
  categories: INITIAL_CATEGORIES,
  recurring: INITIAL_RECURRING,
});
assert.equal(txRes.count, 2);
const predRes = runReadTool("get_financial_prediction", { monthsAhead: 3 }, {
  bankBalance: 100000,
  transactions: INITIAL_TRANSACTIONS,
  categories: INITIAL_CATEGORIES,
  recurring: INITIAL_RECURRING,
});
assert.equal(predRes.monthsAhead, 3);
assert.equal(predRes.activeRecurringMonthly, 13500);
assert.equal(predRes.activeRecurringIncomeMonthly, 50000);
assert.equal(predRes.baselineMonthlyIncome, 50000);
assert.equal(Array.isArray(predRes.assumptions), true);

// 9. Write-tool validator normalizes aliases, rejects unknown categories, and guards overdrafts
const snap = {
  bankBalance: 500,
  transactions: INITIAL_TRANSACTIONS,
  categories: INITIAL_CATEGORIES,
  recurring: INITIAL_RECURRING,
  autoDebitOnExpense: true,
};
const aliased = validateAndNormalizeWriteTool(
  "add_transaction",
  { type: "expense", title: "BTS Ticket", amount: 100, categoryId: "transportation" },
  snap
);
assert.equal(aliased.ok, true);
if (aliased.ok) assert.equal(aliased.args.categoryId, "transport");

const badCat = validateAndNormalizeWriteTool(
  "add_transaction",
  { type: "expense", title: "Mystery", amount: 100, categoryId: "crypto_moon" },
  snap
);
assert.equal(badCat.ok, false);

const tooExpensive = validateAndNormalizeWriteTool(
  "add_transaction",
  { type: "expense", title: "Laptop", amount: 25000, categoryId: "shopping" },
  snap
);
assert.equal(tooExpensive.ok, true);

const cashWithinBalance = validateAndNormalizeWriteTool(
  "add_transaction",
  { type: "expense", title: "Cash Market", amount: 100, categoryId: "food", channel: "cash" },
  snap
);
assert.equal(cashWithinBalance.ok, true);
if (cashWithinBalance.ok) assert.equal(cashWithinBalance.args.channel, "เงินสด");

const cashOverdraft = validateAndNormalizeWriteTool(
  "add_transaction",
  { type: "expense", title: "Cash Laptop", amount: 25000, categoryId: "food", channel: "เงินสด" },
  snap
);
assert.equal(cashOverdraft.ok, true);

// 10. add_recurring_payment validator handles defaults and duplicate protection
const newRec = validateAndNormalizeWriteTool("add_recurring_payment", { title: "YouTube Premium", amount: 179 }, snap);
assert.equal(newRec.ok, true);
if (newRec.ok) {
  assert.equal(newRec.args.cycle, "monthly");
  assert.match(String(newRec.args.nextDueDate), /^\d{4}-\d{2}-\d{2}$/);
}
const dupRec = validateAndNormalizeWriteTool("add_recurring_payment", { title: INITIAL_RECURRING[0].title, amount: 419 }, snap);
assert.equal(dupRec.ok, false);

// 11. Tool execution priority orders income and config before expense
assert.equal(
  getToolExecutionPriority("add_recurring_payment", {}) <
    getToolExecutionPriority("add_transaction", { type: "expense" }),
  true
);
assert.equal(
  getToolExecutionPriority("add_transaction", { type: "income" }) <
    getToolExecutionPriority("add_transaction", { type: "expense" }),
  true
);

// 12. add_recurring_payment supports recurring income and get_recurring_payments separates expense/income totals
const incomeRec = validateAndNormalizeWriteTool(
  "add_recurring_payment",
  { type: "income", title: "ค่าเช่าบ้านปล่อยเช่า", amount: 18000, categoryId: "เงินเดือน" },
  snap
);
assert.equal(incomeRec.ok, true);
if (incomeRec.ok) {
  assert.equal(incomeRec.args.type, "income");
  assert.equal(incomeRec.args.categoryId, "salary");
  assert.equal(incomeRec.args.icon, "payments");
}
const recRead = runReadTool("get_recurring_payments", {}, {
  ...snap,
  recurring: [
    ...INITIAL_RECURRING,
    {
      id: "rec-inc-1",
      title: "เงินปันผลรายเดือน",
      amount: 12000,
      type: "income",
      categoryId: "investment",
      cycle: "monthly",
      nextDueDate: relativeDateYmd(5),
      active: true,
      icon: "payments",
    },
  ],
});
assert.equal(recRead.activeMonthlyIncomeTotal, 62000); // 50000 (เงินเดือนประจำ) + 12000

// 13. parseQrSlipResult validates JSON fixtures, formatted amounts, sender/receiver matching, and blocks reserved "recurring" category
const qrValid = parseQrSlipResult(
  '```json\n{"isValidPaymentImage":true,"type":"expense","sender":"นาย ชัยณรงค์ แ...","receiver":"บริษัท แอดวานซ์ เอ็มเปย์ จำกัด","merchant":"นาย ชัยณรงค์ แ...","promptPayId":"0891112222","amount":"1,725.50 บาท","categoryId":"recurring"}\n```',
  ["food", "shopping", "salary"],
  "คุณชัยณรงค์ วงศ์เจริญ"
);
assert.equal(qrValid.ok, true);
if (qrValid.ok) {
  assert.equal(qrValid.data.isValidPaymentImage, true);
  assert.equal(qrValid.data.amount, 1725.5);
  assert.equal(qrValid.data.sender, "นาย ชัยณรงค์");
  assert.equal(qrValid.data.receiver, "บริษัท แอดวานซ์ เอ็มเปย์ จำกัด");
  assert.equal(qrValid.data.merchant, "บริษัท แอดวานซ์ เอ็มเปย์ จำกัด");
  assert.equal(qrValid.data.categoryId, "food");
}
const qrInvalid = parseQrSlipResult("not a json object");
assert.equal(qrInvalid.ok, false);

// 14. Date-driven rollover processes recurring income (including salary) and expense bills chronologically, allowing negative balance
// Step 1 (+3 days): Netflix (+1d, 500) and Condo (+3d, 12000) are both paid from 10,000 -> -2,500
const step1 = simulateRolloverToDate({
  targetDate: relativeDateYmd(3),
  bankBalance: INITIAL_BANK_BALANCE, // 10,000
  recurring: INITIAL_RECURRING,
  settings: { ...INITIAL_SETTINGS, quotaResetDay: 1 },
  nowMs: 1700000000000,
});
assert.equal(step1.result.recurringIncomeTotal, 0);
assert.equal(step1.result.billsPaid, 2);
assert.equal(step1.result.billsSkipped, 0);
assert.equal(step1.bankBalance, -2500);

// Step 2 (+7 days): Salary (+7d, +50,000) brings balance to 47,500
const step2 = simulateRolloverToDate({
  targetDate: relativeDateYmd(7),
  bankBalance: step1.bankBalance,
  recurring: step1.updatedRecurring,
  settings: { ...INITIAL_SETTINGS, quotaResetDay: 1, ...step1.settingsPatch },
  nowMs: 1700000001000,
});
assert.equal(step2.result.recurringIncomeCount, 1);
assert.equal(step2.result.recurringIncomeTotal, 50000);
assert.equal(step2.result.billsSkipped, 0);
assert.equal(step2.result.billsPaid, 0);
assert.equal(step2.bankBalance, 47500);

// Step 3 (+10 days): AIS Fibre (+10d, 1,000) paid -> 46,500
const step3 = simulateRolloverToDate({
  targetDate: relativeDateYmd(10),
  bankBalance: step2.bankBalance,
  recurring: step2.updatedRecurring,
  settings: { ...INITIAL_SETTINGS, quotaResetDay: 1, ...step2.settingsPatch },
  nowMs: 1700000002000,
});
assert.equal(step3.result.recurringIncomeTotal, 0);
assert.equal(step3.result.billsPaid, 1);
assert.equal(step3.bankBalance, 46500);

// 15. buildQrSlipPrompt injects OCR assist block only when non-empty
const promptWithOcr = buildQrSlipPrompt(undefined, "food", "คุณธนภัทร", "Potato shake & ข้าวหมู\nกรอบ\n30.00 บาท");
assert.equal(promptWithOcr.includes("ข้อความที่อ่านได้จาก OCR"), true);
assert.equal(promptWithOcr.includes("Potato shake & ข้าวหมู"), true);
const promptWithoutOcr = buildQrSlipPrompt(undefined, "food", "คุณธนภัทร", "   ");
assert.equal(promptWithoutOcr.includes("ข้อความที่อ่านได้จาก OCR"), false);

// 16. add_transaction falls back to title-based category resolution while preserving explicit categoryId precedence
const fallbackCoffee = validateAndNormalizeWriteTool(
  "add_transaction",
  { type: "expense", title: "กาแฟ", amount: 30, categoryId: "other" },
  snap
);
assert.equal(fallbackCoffee.ok, true);
if (fallbackCoffee.ok) assert.equal(fallbackCoffee.args.categoryId, "food");

const aliasCafe = validateAndNormalizeWriteTool(
  "add_transaction",
  { type: "expense", title: "Latte", amount: 120, categoryId: "cafe" },
  snap
);
assert.equal(aliasCafe.ok, true);
if (aliasCafe.ok) assert.equal(aliasCafe.args.categoryId, "food");

const fallbackTransit = validateAndNormalizeWriteTool(
  "add_transaction",
  { type: "expense", title: "ค่ารถไฟฟ้า BTS", amount: 45, categoryId: "misc" },
  snap
);
assert.equal(fallbackTransit.ok, true);
if (fallbackTransit.ok) assert.equal(fallbackTransit.args.categoryId, "transport");

const explicitWins = validateAndNormalizeWriteTool(
  "add_transaction",
  { type: "expense", title: "ซื้อกาแฟเป็นของขวัญ", amount: 250, categoryId: "shopping" },
  snap
);
assert.equal(explicitWins.ok, true);
if (explicitWins.ok) assert.equal(explicitWins.args.categoryId, "shopping");

const unresolvedBoth = validateAndNormalizeWriteTool(
  "add_transaction",
  { type: "expense", title: "รายการไม่ระบุ", amount: 100, categoryId: "other" },
  snap
);
assert.equal(unresolvedBoth.ok, false);

// 17. Negative THB formatting, date-only Thai formatting, and transaction date normalization
assert.equal(formatTHB(-1250), "-฿1,250.00");
assert.equal(formatTHB(1250), "฿1,250.00");
assert.equal(formatThaiDate("2026-08-15T12:00:00+07:00").includes(":"), false);

const fixedRef = new Date(2026, 10, 21);
assert.equal(normalizeTransactionDate("15/08", fixedRef), "2026-08-15");
assert.equal(normalizeTransactionDate("2026-08-15", fixedRef), "2026-08-15");
assert.equal(normalizeTransactionDate("15/08/2569", fixedRef), "2026-08-15");
assert.equal(normalizeTransactionDate("2569-08-15", fixedRef), "2026-08-15");
assert.equal(normalizeTransactionDate("31/02", fixedRef), null);

const datedTx = validateAndNormalizeWriteTool(
  "add_transaction",
  { type: "expense", title: "กระเพรา", amount: 20, categoryId: "food", date: "15/08" },
  snap
);
assert.equal(datedTx.ok, true);
if (datedTx.ok) assert.match(String(datedTx.args.date), /^\d{4}-08-15$/);

const badDateTx = validateAndNormalizeWriteTool(
  "add_transaction",
  { type: "expense", title: "ชานม", amount: 20, categoryId: "food", date: "31/02" },
  snap
);
assert.equal(badDateTx.ok, false);

// 18. Currency rounding (2 decimals) and relative Thai/English date words
assert.equal(normalizeTransactionDate("วันนี้", fixedRef), "2026-11-21");
assert.equal(normalizeTransactionDate("เมื่อวาน", fixedRef), "2026-11-20");
assert.equal(normalizeTransactionDate("เมื่อวานซืน", fixedRef), "2026-11-19");
assert.equal(normalizeTransactionDate("yesterday", fixedRef), "2026-11-20");
assert.equal(normalizeTransactionDate("พรุ่งนี้", fixedRef), "2026-11-22");

const roundUpTx = validateAndNormalizeWriteTool(
  "add_transaction",
  { type: "expense", title: "กาแฟ", amount: 19.999, categoryId: "food" },
  snap
);
assert.equal(roundUpTx.ok, true);
if (roundUpTx.ok) assert.equal(roundUpTx.args.amount, 20);

const roundFracTx = validateAndNormalizeWriteTool(
  "add_transaction",
  { type: "expense", title: "ขนม", amount: 10.126, categoryId: "food" },
  snap
);
assert.equal(roundFracTx.ok, true);
if (roundFracTx.ok) assert.equal(roundFracTx.args.amount, 10.13);

const roundBudget = validateAndNormalizeWriteTool(
  "update_category_budget",
  { categoryId: "food", budget: 4999.996 },
  snap
);
assert.equal(roundBudget.ok, true);
if (roundBudget.ok) assert.equal(roundBudget.args.budget, 5000);

// 19. cleanOcrText strips demo notes and parseQrSlipResult extracts optional BE/CE slip dates
const cleanedOcr = cleanOcrText(
  "[Note: the 'helloworld' demo key is rate limited]\nร้านกาแฟ\n\n\n30.00 บาท"
);
assert.equal(cleanedOcr.includes("helloworld"), false);
assert.equal(cleanedOcr, "ร้านกาแฟ\n\n30.00 บาท");

const slipWithBeDate = parseQrSlipResult(
  JSON.stringify({
    isValidPaymentImage: true,
    type: "expense",
    receiver: "Cafe",
    amount: 65,
    categoryId: "food",
    date: "15/08/2569",
  }),
  ["food"]
);
assert.equal(slipWithBeDate.ok, true);
if (slipWithBeDate.ok) assert.equal(slipWithBeDate.data.date, "2026-08-15");

const slipNoDate = parseQrSlipResult(
  JSON.stringify({
    isValidPaymentImage: true,
    type: "expense",
    receiver: "QR Stand",
    amount: 0,
    categoryId: "food",
    date: "",
  }),
  ["food"]
);
assert.equal(slipNoDate.ok, true);
if (slipNoDate.ok) assert.equal(slipNoDate.data.date, undefined);

// 20. Cycle-aware overview, budget metrics in get_categories, and net recurring summary
const cycleSnapshot = {
  bankBalance: 3200,
  categories: INITIAL_CATEGORIES,
  recurring: INITIAL_RECURRING,
  quotaResetAt: "2026-10-01T00:00:00+07:00",
  transactions: [
    {
      id: "old-food",
      ref: "OLD-1",
      title: "Old Dinner",
      amount: 900,
      type: "expense" as const,
      categoryId: "food",
      channel: "เงินสด",
      date: "2026-09-15T12:00:00+07:00",
      status: "completed" as const,
    },
    {
      id: "new-food",
      ref: "NEW-1",
      title: "New Lunch",
      amount: 2500,
      type: "expense" as const,
      categoryId: "food",
      channel: "Virtual Bank Wallet",
      date: "2026-10-10T12:00:00+07:00",
      status: "completed" as const,
    },
    {
      id: "new-salary",
      ref: "NEW-2",
      title: "Oct Salary",
      amount: 30000,
      type: "income" as const,
      categoryId: "salary",
      channel: "Virtual Bank Wallet",
      date: "2026-10-05T12:00:00+07:00",
      status: "completed" as const,
    },
  ],
};

const overviewCycle = runReadTool("get_financial_overview", {}, cycleSnapshot);
assert.equal(overviewCycle.totalExpense, 3400);
assert.equal(overviewCycle.currentCycleExpense, 2500);
assert.equal(overviewCycle.currentCycleIncome, 30000);
assert.equal(overviewCycle.currentCycleNet, 27500);

const catSummary = runReadTool("get_categories", {}, cycleSnapshot) as {
  categories: Array<{
    id: string;
    spent: number;
    remainingBudget: number;
    overBudgetAmount: number;
    usagePercent: number;
  }>;
};
const foodCat = catSummary.categories.find((c) => c.id === "food");
assert.equal(foodCat?.spent, 2500);
assert.equal(foodCat?.remainingBudget, 7500);
assert.equal(foodCat?.overBudgetAmount, 0);
assert.equal(foodCat?.usagePercent, 25);

const recMetrics = runReadTool("get_recurring_payments", {}, cycleSnapshot);
assert.equal(recMetrics.currentBankBalance, 3200);
assert.equal(recMetrics.monthlyNetRecurring, 36500); // 50000 - (500 + 12000 + 1000)

// 21. get_transactions date-range filtering + aggregate totals, and prediction rolling-30d baseline
const augFilter = runReadTool(
  "get_transactions",
  { startDate: "2026-09-01", endDate: "2026-09-30", type: "expense" },
  cycleSnapshot
);
assert.equal(augFilter.totalMatchedCount, 1);
assert.equal(augFilter.totalMatchedAmount, 900);

const swappedFilter = runReadTool(
  "get_transactions",
  { startDate: "2026-09-30", endDate: "2026-09-01", type: "expense" },
  cycleSnapshot
);
assert.equal(swappedFilter.totalMatchedCount, 1);
assert.equal(swappedFilter.totalMatchedAmount, 900);

const badRange = runReadTool("get_transactions", { startDate: "31/02" }, cycleSnapshot);
assert.equal(typeof badRange.error, "string");

const rollingSnapshot = {
  bankBalance: 20000,
  categories: INITIAL_CATEGORIES,
  recurring: [],
  transactions: [
    {
      id: "old-90d",
      ref: "OLD-90",
      title: "Old Car Repair",
      amount: 50000,
      type: "expense" as const,
      categoryId: "transport",
      channel: "Virtual Bank Wallet",
      date: `${relativeDateYmd(-90)}T12:00:00+07:00`,
      status: "completed" as const,
    },
    {
      id: "recent-2d",
      ref: "REC-2",
      title: "Recent Lunch",
      amount: 1000,
      type: "expense" as const,
      categoryId: "food",
      channel: "Virtual Bank Wallet",
      date: `${relativeDateYmd(-2)}T12:00:00+07:00`,
      status: "completed" as const,
    },
  ],
};
const predRolling = runReadTool("get_financial_prediction", { monthsAhead: 1 }, rollingSnapshot);
assert.equal(predRolling.baselineMonthlyOutflow, 1000);

// 22. Proactive non-blocking warnings & flexible recurring due-date validation
const lowBudgetWarn = validateAndNormalizeWriteTool(
  "update_category_budget",
  { categoryId: "food", budget: 500 },
  snap
);
assert.equal(lowBudgetWarn.ok, true);
if (lowBudgetWarn.ok) assert.equal(lowBudgetWarn.summary.includes("⚠️"), true);

const pastDueWarn = validateAndNormalizeWriteTool(
  "add_recurring_payment",
  { title: "Old Gym", amount: 900, nextDueDate: "2020-01-01" },
  snap
);
assert.equal(pastDueWarn.ok, true);
if (pastDueWarn.ok) assert.equal(pastDueWarn.summary.includes("⚠️"), true);

const badRecDate = validateAndNormalizeWriteTool(
  "add_recurring_payment",
  { title: "Bad Date Rec", amount: 900, nextDueDate: "31/02" },
  snap
);
assert.equal(badRecDate.ok, false);

console.log("Finora self-check passed (22/22 checks)");
