import assert from "node:assert/strict";
import { executeBankTransfer } from "./bank-service.ts";
import { CATEGORY_ICON_IDS, READ_TOOL_NAMES, WRITE_TOOL_NAMES, getToolExecutionPriority, resolveCategory, runReadTool, validateAndNormalizeWriteTool } from "./ai-tools.ts";
import { computeFinancialInsights, formatCompactInsightsForPrompt } from "./financial-insights.ts";
import { cleanOcrText } from "./ocr.ts";
import { FINORA_PROMPT_VERSION, buildFinoraSystemPrompt, buildSlipPrompt, parseSlipResult } from "./prompts.ts";
import { simulateRolloverToDate } from "./rollover.ts";
import { CATEGORY_PALETTE, INITIAL_BANK_BALANCE, INITIAL_CATEGORIES, INITIAL_LEDGER, INITIAL_RECURRING, INITIAL_SETTINGS, INITIAL_TRANSACTIONS, INITIAL_USER, formatTHB, formatThaiDate, isBaseCategory, isInCurrentQuotaCycle, matchesTransactionDateQuery, nextCategoryColor, normalizeTransactionDate, relativeDateYmd, todayYmd } from "./seed.ts";

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

// 7. AI read tools return real transaction data and deterministic prediction with assumptions
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

// 8. Write-tool validator normalizes aliases, rejects unknown categories, and guards overdrafts
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

// 9. add_recurring_payment validator handles defaults and duplicate protection
const newRec = validateAndNormalizeWriteTool("add_recurring_payment", { title: "YouTube Premium", amount: 179 }, snap);
assert.equal(newRec.ok, true);
if (newRec.ok) {
  assert.equal(newRec.args.cycle, "monthly");
  assert.match(String(newRec.args.nextDueDate), /^\d{4}-\d{2}-\d{2}$/);
}
const dupRec = validateAndNormalizeWriteTool("add_recurring_payment", { title: INITIAL_RECURRING[0].title, amount: 419 }, snap);
assert.equal(dupRec.ok, false);

// 10. Tool execution priority orders new category, income, and config before expense
assert.equal(
  getToolExecutionPriority("add_category", {}) <
    getToolExecutionPriority("add_transaction", { type: "income" }),
  true
);
assert.equal(
  getToolExecutionPriority("add_category", {}) <
    getToolExecutionPriority("add_transaction", { type: "expense" }),
  true
);
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

// 11. add_recurring_payment supports recurring income and get_recurring_payments separates expense/income totals
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

// 12. parseSlipResult validates JSON fixtures, formatted amounts, sender/receiver matching, and blocks reserved "recurring" category
const slipValid = parseSlipResult(
  '```json\n{"isValidPaymentImage":true,"type":"expense","sender":"นาย ชัยณรงค์ แ...","receiver":"บริษัท แอดวานซ์ เอ็มเปย์ จำกัด","merchant":"นาย ชัยณรงค์ แ...","promptPayId":"0891112222","amount":"1,725.50 บาท","categoryId":"recurring"}\n```',
  ["food", "shopping", "salary"],
  "คุณชัยณรงค์ วงศ์เจริญ"
);
assert.equal(slipValid.ok, true);
if (slipValid.ok) {
  assert.equal(slipValid.data.isValidPaymentImage, true);
  assert.equal(slipValid.data.amount, 1725.5);
  assert.equal(slipValid.data.sender, "นาย ชัยณรงค์");
  assert.equal(slipValid.data.receiver, "บริษัท แอดวานซ์ เอ็มเปย์ จำกัด");
  assert.equal(slipValid.data.merchant, "บริษัท แอดวานซ์ เอ็มเปย์ จำกัด");
  assert.equal(slipValid.data.categoryId, "food");
}
const slipInvalid = parseSlipResult("not a json object");
assert.equal(slipInvalid.ok, false);

// 13. Date-driven rollover processes recurring income (including salary) and expense bills chronologically, allowing negative balance
// Step 1 (+3 days): Netflix (+1d, 500) and Condo (+3d, 12000) are both paid from 10,000 -> -2,500
const step1 = simulateRolloverToDate({
  targetDate: relativeDateYmd(3),
  bankBalance: 10000,
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

// 14. buildSlipPrompt injects OCR assist block only when non-empty
const promptWithOcr = buildSlipPrompt("food", "คุณธนภัทร", "Potato shake & ข้าวหมู\nกรอบ\n30.00 บาท");
assert.equal(promptWithOcr.includes("ข้อความที่อ่านได้จาก OCR"), true);
assert.equal(promptWithOcr.includes("Potato shake & ข้าวหมู"), true);
const promptWithoutOcr = buildSlipPrompt("food", "คุณธนภัทร", "   ");
assert.equal(promptWithoutOcr.includes("ข้อความที่อ่านได้จาก OCR"), false);

// 15. add_transaction falls back to title-based category resolution while preserving explicit categoryId precedence
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

// 16. Negative THB formatting, date-only Thai formatting, and transaction date normalization
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

// 17. Currency rounding (2 decimals) and relative Thai/English date words
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

// 18. cleanOcrText strips demo notes and parseSlipResult extracts optional BE/CE slip dates
const cleanedOcr = cleanOcrText(
  "[Note: the 'helloworld' demo key is rate limited]\nร้านกาแฟ\n\n\n30.00 บาท"
);
assert.equal(cleanedOcr.includes("helloworld"), false);
assert.equal(cleanedOcr, "ร้านกาแฟ\n\n30.00 บาท");

const slipWithBeDate = parseSlipResult(
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

const slipNoDate = parseSlipResult(
  JSON.stringify({
    isValidPaymentImage: true,
    type: "expense",
    receiver: "Slip Without Date",
    amount: 0,
    categoryId: "food",
    date: "",
  }),
  ["food"]
);
assert.equal(slipNoDate.ok, true);
if (slipNoDate.ok) assert.equal(slipNoDate.data.date, undefined);

// 19. Cycle-aware overview, budget metrics in get_categories, and net recurring summary
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

// 20. get_transactions date-range filtering + aggregate totals, and prediction rolling-30d baseline
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

// 21. Proactive non-blocking warnings & flexible recurring due-date validation
const lowBudgetWarn = validateAndNormalizeWriteTool(
  "update_category_budget",
  { categoryId: "food", budget: 500 },
  {
    ...snap,
    transactions: [
      {
        id: "cur-month-food",
        ref: "CUR-1",
        title: "Lunch Today",
        amount: 1500,
        type: "expense",
        categoryId: "food",
        channel: "Virtual Bank Wallet",
        date: `${todayYmd()}T12:00:00+07:00`,
        status: "completed",
      },
    ],
  }
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

// 22. Unset quotaResetAt falls back to current local month while preserving explicit reset cutoffs
const cycleRefDate = new Date(2026, 10, 21);
assert.equal(isInCurrentQuotaCycle("2026-11-15T12:00:00+07:00", undefined, cycleRefDate), true);
assert.equal(isInCurrentQuotaCycle("2026-08-15T12:00:00+07:00", undefined, cycleRefDate), false);
assert.equal(isInCurrentQuotaCycle("2026-12-01T12:00:00+07:00", undefined, cycleRefDate), false);
assert.equal(
  isInCurrentQuotaCycle("2026-10-10T12:00:00+07:00", "2026-10-01T00:00:00+07:00", cycleRefDate),
  true
);
assert.equal(isInCurrentQuotaCycle("not-a-date", undefined, cycleRefDate), false);

const unsetResetCatSummary = runReadTool("get_categories", {}, {
  bankBalance: 10000,
  categories: INITIAL_CATEGORIES,
  recurring: INITIAL_RECURRING,
  transactions: [
    {
      id: "old-90d-food",
      ref: "OLD-90F",
      title: "Old Food",
      amount: 4000,
      type: "expense",
      categoryId: "food",
      channel: "Virtual Bank Wallet",
      date: `${relativeDateYmd(-90)}T12:00:00+07:00`,
      status: "completed",
    },
    {
      id: "cur-food",
      ref: "CUR-F",
      title: "Current Month Food",
      amount: 1200,
      type: "expense",
      categoryId: "food",
      channel: "Virtual Bank Wallet",
      date: `${todayYmd()}T12:00:00+07:00`,
      status: "completed",
    },
  ],
}) as {
  categories: Array<{ id: string; spent: number; remainingBudget: number }>;
};
const unsetFoodCat = unsetResetCatSummary.categories.find((c) => c.id === "food");
assert.equal(unsetFoodCat?.spent, 1200);
assert.equal(unsetFoodCat?.remainingBudget, 8800);

// 23. add_category validation, toggle_recurring removal, exact-name category match, and chained category+tx
assert.equal(WRITE_TOOL_NAMES.has("add_category"), true);
assert.equal(WRITE_TOOL_NAMES.has("toggle_recurring"), false);
assert.equal(validateAndNormalizeWriteTool("toggle_recurring", { recurringId: "rec-1" }, snap).ok, false);

const petCat = validateAndNormalizeWriteTool(
  "add_category",
  { name: "สัตว์เลี้ยง", icon: "pets" },
  snap
);
assert.equal(petCat.ok, true);
if (petCat.ok) {
  assert.equal(petCat.args.type, "expense");
  assert.equal(petCat.args.budget, 0);
  assert.equal(petCat.args.icon, "pets");
  assert.match(String(petCat.args.color), /^#[0-9A-F]{6}$/);
  assert.equal(
    INITIAL_CATEGORIES.some((c) => c.color.toUpperCase() === String(petCat.args.color).toUpperCase()),
    false
  );
}

const fallbackExpenseIcon = validateAndNormalizeWriteTool(
  "add_category",
  { name: "สุขภาพ", type: "expense", icon: "nonexistent_icon", budget: 2500 },
  snap
);
assert.equal(fallbackExpenseIcon.ok, true);
if (fallbackExpenseIcon.ok) {
  assert.equal(fallbackExpenseIcon.args.icon, "label");
  assert.equal(fallbackExpenseIcon.args.budget, 2500);
}

const incomeCat = validateAndNormalizeWriteTool(
  "add_category",
  { name: "งานฟรีแลนซ์", type: "income", budget: 9999, icon: "invalid_icon" },
  snap
);
assert.equal(incomeCat.ok, true);
if (incomeCat.ok) {
  assert.equal(incomeCat.args.type, "income");
  assert.equal(incomeCat.args.budget, 0);
  assert.equal(incomeCat.args.icon, "payments");
}
assert.equal(CATEGORY_ICON_IDS.includes("pets"), true);

const dupExpenseCat = validateAndNormalizeWriteTool(
  "add_category",
  { name: INITIAL_CATEGORIES[0].name, type: "expense", budget: 5000 },
  snap
);
assert.equal(dupExpenseCat.ok, false);
if (!dupExpenseCat.ok) assert.equal(dupExpenseCat.error.includes("update_category_budget"), true);

const oppositeTypeSameName = validateAndNormalizeWriteTool(
  "add_category",
  { name: INITIAL_CATEGORIES[0].name, type: "income" },
  snap
);
assert.equal(oppositeTypeSameName.ok, true);

const subCat = validateAndNormalizeWriteTool(
  "add_category",
  { name: "อาหารแมว", type: "expense", budget: 1500 },
  snap
);
assert.equal(subCat.ok, true);

assert.equal(validateAndNormalizeWriteTool("add_category", { name: "recurring" }, snap).ok, false);
assert.equal(validateAndNormalizeWriteTool("add_category", { name: "รายจ่ายประจำ" }, snap).ok, false);

// Custom category named "กาแฟ" resolves ahead of CATEGORY_ALIASES["กาแฟ"] -> "food"
const customCoffeeSnap = {
  ...snap,
  categories: [
    ...INITIAL_CATEGORIES,
    { id: "cat-coffee", name: "กาแฟ", icon: "local_cafe", color: "#0891B2", budget: 1500, type: "expense" as const },
  ],
};
assert.equal(resolveCategory("กาแฟ", customCoffeeSnap.categories, "expense")?.id, "cat-coffee");

// Chained add_category + add_transaction simulation resolves to drafted category ID
if (petCat.ok) {
  const draftedCategories = [
    ...snap.categories,
    {
      id: "draft-cat-0",
      name: String(petCat.args.name),
      type: "expense" as const,
      budget: Number(petCat.args.budget),
      icon: String(petCat.args.icon),
      color: String(petCat.args.color),
    },
  ];
  const chainedTx = validateAndNormalizeWriteTool(
    "add_transaction",
    { type: "expense", title: "อาหารแมว", amount: 500, categoryId: "สัตว์เลี้ยง" },
    { ...snap, categories: draftedCategories }
  );
  assert.equal(chainedTx.ok, true);
  if (chainedTx.ok) assert.equal(chainedTx.args.categoryId, "draft-cat-0");
}

// 24. matchesTransactionDateQuery supports day-of-month, DD/MM, full dates, Thai months, and avoids false positives
const sampleNov16 = "2026-11-16T18:30:00+07:00";
const sampleNov06 = "2026-11-06T10:00:00+07:00";
const sampleRefDate = new Date(2026, 10, 17); // 2026-11-17
assert.equal(matchesTransactionDateQuery(sampleNov16, "16", sampleRefDate), true);
assert.equal(matchesTransactionDateQuery(sampleNov16, "วันที่ 16", sampleRefDate), true);
assert.equal(matchesTransactionDateQuery(sampleNov06, "16", sampleRefDate), false);
assert.equal(matchesTransactionDateQuery(sampleNov16, "6", sampleRefDate), false);
assert.equal(matchesTransactionDateQuery(sampleNov06, "6", sampleRefDate), true);
assert.equal(matchesTransactionDateQuery(sampleNov06, "06", sampleRefDate), true);
assert.equal(matchesTransactionDateQuery(sampleNov16, "16/11", sampleRefDate), true);
assert.equal(matchesTransactionDateQuery(sampleNov16, "16-11", sampleRefDate), true);
assert.equal(matchesTransactionDateQuery(sampleNov16, "16/10", sampleRefDate), false);
assert.equal(matchesTransactionDateQuery(sampleNov16, "16/11/2569", sampleRefDate), true);
assert.equal(matchesTransactionDateQuery(sampleNov16, "2026-11-16", sampleRefDate), true);
assert.equal(matchesTransactionDateQuery(sampleNov16, "เมื่อวาน", sampleRefDate), true);
assert.equal(matchesTransactionDateQuery(sampleNov16, "16 พ.ย.", sampleRefDate), true);
assert.equal(matchesTransactionDateQuery(sampleNov16, "6 พ.ย.", sampleRefDate), false);
assert.equal(matchesTransactionDateQuery(sampleNov06, "6 พ.ย.", sampleRefDate), true);
assert.equal(matchesTransactionDateQuery(sampleNov06, "06 พ.ย.", sampleRefDate), true);
assert.equal(matchesTransactionDateQuery(sampleNov16, "06 พ.ย.", sampleRefDate), false);
assert.equal(matchesTransactionDateQuery(sampleNov16, "พ.ย.", sampleRefDate), true);
assert.equal(matchesTransactionDateQuery(sampleNov16, "พ.ย. 2569", sampleRefDate), true);
assert.equal(matchesTransactionDateQuery(sampleNov16, "พฤศจิกายน", sampleRefDate), true);
assert.equal(matchesTransactionDateQuery(sampleNov16, "2026-11", sampleRefDate), true);
assert.equal(matchesTransactionDateQuery(sampleNov16, "2569", sampleRefDate), true);
assert.equal(matchesTransactionDateQuery(sampleNov16, "500", sampleRefDate), false);
assert.equal(matchesTransactionDateQuery(sampleNov16, "กา", sampleRefDate), false);
assert.equal(matchesTransactionDateQuery("2026-10-16T12:00:00+07:00", "ลา", sampleRefDate), false);
assert.equal(matchesTransactionDateQuery(sampleNov16, "-", sampleRefDate), false);
assert.equal(matchesTransactionDateQuery(sampleNov16, "พ", sampleRefDate), false);

// 25. Coaching prompt v2.9.0 and get_spending_insights tool registration
assert.equal(FINORA_PROMPT_VERSION, "2.9.0");
assert.equal(READ_TOOL_NAMES.has("get_spending_insights"), true);
assert.equal(buildFinoraSystemPrompt("สรุปตัวอย่าง").includes("get_spending_insights"), true);

// 26. Multi-month financial insights (MoM, savings rate, burn pace, anomalies, savings simulation)
const augRefDate = new Date(2026, 7, 15, 12, 0, 0); // Aug 15, 2026 -> 17 days remaining, 48% elapsed
const multiMonthTxs = [
  { id: "m-inc-prev", ref: "P1", title: "เงินเดือน ก.ค.", amount: 40000, type: "income" as const, categoryId: "salary", channel: "Virtual Bank Wallet", date: "2026-07-05T12:00:00+07:00", status: "completed" as const },
  { id: "m-food-prev", ref: "P2", title: "อาหาร ก.ค.", amount: 3000, type: "expense" as const, categoryId: "food", channel: "Virtual Bank Wallet", date: "2026-07-10T12:00:00+07:00", status: "completed" as const },
  { id: "m-shop-prev", ref: "P3", title: "ช้อปปิ้ง ก.ค.", amount: 2000, type: "expense" as const, categoryId: "shopping", channel: "Virtual Card", date: "2026-07-15T12:00:00+07:00", status: "completed" as const },
  { id: "m-inc-curr", ref: "C1", title: "เงินเดือน ส.ค.", amount: 50000, type: "income" as const, categoryId: "salary", channel: "Virtual Bank Wallet", date: "2026-08-05T12:00:00+07:00", status: "completed" as const },
  { id: "m-food-curr", ref: "C2", title: "ร้านอาหาร ส.ค.", amount: 8500, type: "expense" as const, categoryId: "food", channel: "Virtual Bank Wallet", date: "2026-08-08T12:00:00+07:00", status: "completed" as const },
  { id: "m-shop-curr", ref: "C3", title: "ช้อปปิ้ง ส.ค.", amount: 9000, type: "expense" as const, categoryId: "shopping", channel: "Virtual Card", date: "2026-08-10T12:00:00+07:00", status: "completed" as const },
  { id: "m-trans-curr", ref: "C4", title: "เดินทาง ส.ค.", amount: 3500, type: "expense" as const, categoryId: "transport", channel: "สแกน PromptPay QR", date: "2026-08-11T12:00:00+07:00", status: "completed" as const },
  { id: "m-house-curr", ref: "C5", title: "ค่าไฟ ส.ค.", amount: 4000, type: "expense" as const, categoryId: "housing", channel: "Virtual Bank Wallet", date: "2026-08-12T12:00:00+07:00", status: "completed" as const },
];
const fullInsights = computeFinancialInsights({
  bankBalance: 34000,
  transactions: multiMonthTxs,
  categories: INITIAL_CATEGORIES,
  recurring: INITIAL_RECURRING,
  referenceDate: augRefDate,
  topN: 4,
});
assert.equal(fullInsights.monthProgress.daysRemaining, 17);
assert.equal(fullInsights.monthProgress.elapsedPct, 48);
assert.equal(fullInsights.periodTotals.incomeChangePct, 25);
assert.equal(fullInsights.periodTotals.expenseChangePct, 400);
assert.equal(fullInsights.savings.savingsRatePct, 50);
assert.equal(fullInsights.savings.dailySafeSpendFromBudget, 941.18);
assert.equal(fullInsights.savings.dailySafeSpendFromWallet, 2000);
assert.equal(fullInsights.recurringLoad.recurringLoadPct, 27);
assert.equal(fullInsights.overBudgetCategories[0]?.categoryId, "shopping");
assert.equal(fullInsights.nearBudgetCategories[0]?.categoryId, "food");
assert.equal(fullInsights.aheadOfPaceCategories[0]?.categoryId, "transport");
assert.equal(fullInsights.spendingAnomalies.some((c) => c.categoryId === "shopping"), true);
assert.equal(fullInsights.spendingAnomalies.some((c) => c.categoryId === "food"), true);
assert.equal(fullInsights.topExpenseCategories.length, 4);
assert.equal(fullInsights.topExpenseCategories[0]?.categoryId, "shopping");
assert.equal(fullInsights.savingsOpportunities.length, 3);
assert.equal(
  fullInsights.totalPotentialMonthlySavings,
  fullInsights.savingsOpportunities.reduce((s, item) => s + item.potentialMonthlySavings, 0)
);
assert.equal(fullInsights.savingsDisclaimer, "เป็นเป้าหมายจำลองจากยอดใช้จ่าย ไม่ใช่เงินออมที่เกิดขึ้นจริง");
assert.equal(fullInsights.riskFlags.length >= 3, true);

// 27. Edge cases: first month (no prior data), zero income, zero budgets, negative wallet
const noBudgetCategories = INITIAL_CATEGORIES.map((c) => ({ ...c, budget: 0 }));
const edgeInsights = computeFinancialInsights({
  bankBalance: -2500,
  transactions: [
    { id: "e-1", ref: "E1", title: "ค่ากาแฟ", amount: 500, type: "expense", categoryId: "food", channel: "เงินสด", date: "2026-08-14T12:00:00+07:00", status: "completed" },
  ],
  categories: noBudgetCategories,
  recurring: [],
  referenceDate: augRefDate,
});
assert.equal(edgeInsights.periodTotals.incomeChangePct, null);
assert.equal(edgeInsights.periodTotals.expenseChangePct, null);
assert.equal(edgeInsights.periodTotals.netChangePct, null);
assert.equal(edgeInsights.savings.savingsRatePct, null);
assert.equal(edgeInsights.savings.dailySafeSpendFromBudget, null);
assert.equal(edgeInsights.savings.dailySafeSpendFromWallet, 0);
assert.equal(edgeInsights.recurringLoad.recurringLoadPct, null);
assert.equal(
  edgeInsights.categoryInsights.every((c) => c.paceStatus === "no_budget" && c.usagePct === null),
  true
);
assert.equal(edgeInsights.riskFlags.some((f) => f.includes("ติดลบ")), true);

// 28. runReadTool("get_spending_insights") resolves focusCategoryId and returns top transactions
const insightToolRes = runReadTool(
  "get_spending_insights",
  { topN: 3, focusCategoryId: "อาหาร" },
  {
    bankBalance: 20000,
    transactions: INITIAL_TRANSACTIONS,
    categories: INITIAL_CATEGORIES,
    recurring: INITIAL_RECURRING,
  }
);
assert.equal(Array.isArray(insightToolRes.topExpenseCategories), true);
assert.equal((insightToolRes.topExpenseCategories as unknown[]).length <= 3, true);
const focused = insightToolRes.focusedCategory as Record<string, unknown> | undefined;
assert.equal(focused?.resolved, true);
assert.equal(focused?.categoryId, "food");

// 29. formatCompactInsightsForPrompt formats Thai KPI summary lines
const compactPromptText = formatCompactInsightsForPrompt(fullInsights);
assert.equal(compactPromptText.includes("อัตราการออม"), true);
assert.equal(compactPromptText.includes("เทียบเดือนก่อน (MoM)"), true);
assert.equal(compactPromptText.includes("Daily Safe Spend"), true);
assert.equal(compactPromptText.includes("Recurring Load"), true);

// 30. Enriched 3-month seed dataset integrity & coach insights readiness
assert.equal(INITIAL_USER.name, "นายรัชชานนท์ แก้วกูล");
assert.equal(INITIAL_USER.email, "ratchanon@finora.io");
assert.equal(INITIAL_TRANSACTIONS.length >= 30, true);
assert.equal(INITIAL_LEDGER.length, INITIAL_TRANSACTIONS.length);
assert.equal(INITIAL_LEDGER[0].balanceAfter, INITIAL_BANK_BALANCE);
const seedInsights = computeFinancialInsights({
  bankBalance: INITIAL_BANK_BALANCE,
  transactions: INITIAL_TRANSACTIONS,
  categories: INITIAL_CATEGORIES,
  recurring: INITIAL_RECURRING,
});
assert.notEqual(seedInsights.periodTotals.expenseChangePct, null);
assert.equal(seedInsights.overBudgetCategories.some((c) => c.categoryId === "shopping"), true);
assert.equal(seedInsights.nearBudgetCategories.some((c) => c.categoryId === "food"), true);

console.log("Finora self-check passed (30/30 checks)");
