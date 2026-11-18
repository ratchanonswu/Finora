import assert from "node:assert/strict";
import { executeBankTransfer } from "./bank-service.ts";
import { getToolExecutionPriority, runReadTool, validateAndNormalizeWriteTool } from "./ai-tools.ts";
import { parseQrSlipResult } from "./prompts.ts";
import { simulateRolloverToDate } from "./rollover.ts";
import { CATEGORY_PALETTE, INITIAL_CATEGORIES, INITIAL_RECURRING, INITIAL_SETTINGS, INITIAL_TRANSACTIONS, isBaseCategory, nextCategoryColor, parsePromptPayPayload } from "./seed.ts";

// 1. Valid credit increases balance
const topup = executeBankTransfer({ type: "credit", amount: 5000, title: "Topup", counterparty: "SCB" }, 10000);
assert.equal(topup.ok, true);
assert.equal(topup.balance, 15000);
assert.equal(topup.entry?.balanceAfter, 15000);

// 2. Valid debit decreases balance
const pay = executeBankTransfer({ type: "debit", amount: 2500, title: "Coffee", counterparty: "Cafe" }, 10000);
assert.equal(pay.ok, true);
assert.equal(pay.balance, 7500);

// 3. Overdraft debit is rejected without mutating balance
const overdraft = executeBankTransfer({ type: "debit", amount: 20000, title: "Big", counterparty: "Store" }, 10000);
assert.equal(overdraft.ok, false);
assert.equal(overdraft.balance, 10000);

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
assert.equal(tooExpensive.ok, false);

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
assert.equal(cashOverdraft.ok, false);

// 10. add_recurring_payment validator handles defaults and duplicate protection
const newRec = validateAndNormalizeWriteTool("add_recurring_payment", { title: "YouTube Premium", amount: 179 }, snap);
assert.equal(newRec.ok, true);
if (newRec.ok) {
  assert.equal(newRec.args.cycle, "monthly");
  assert.match(String(newRec.args.nextDueDate), /^\d{4}-\d{2}-\d{2}$/);
}
const dupRec = validateAndNormalizeWriteTool("add_recurring_payment", { title: INITIAL_RECURRING[0].title, amount: 419 }, snap);
assert.equal(dupRec.ok, false);

// 11. Tool execution priority orders credit/income and config before expense/debit
assert.equal(
  getToolExecutionPriority("add_recurring_payment", {}) <
    getToolExecutionPriority("add_transaction", { type: "expense" }),
  true
);
assert.equal(
  getToolExecutionPriority("virtual_bank_transfer", { type: "credit" }) <
    getToolExecutionPriority("virtual_bank_transfer", { type: "debit" }),
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
      nextDueDate: "2025-04-01",
      active: true,
      icon: "payments",
    },
  ],
});
assert.equal(recRead.activeMonthlyIncomeTotal, 67000); // 55000 (เงินเดือนประจำ) + 12000

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

// 14. Date-driven rollover processes recurring income (including salary) and expense bills chronologically
const customRecurring = [
  { id: "rec-sal-test", title: "เงินเดือนประจำ", amount: 30000, type: "income" as const, categoryId: "salary", cycle: "monthly" as const, nextDueDate: "2025-04-25", active: true, icon: "payments" },
  ...INITIAL_RECURRING.filter((r) => r.id !== "rec-salary"),
  { id: "rec-late", title: "หลังเงินเดือนออก", amount: 2000, categoryId: "recurring", cycle: "monthly" as const, nextDueDate: "2025-04-28", active: true, icon: "receipt" },
];
const step1 = simulateRolloverToDate({
  targetDate: "2025-04-06",
  bankBalance: 1000,
  recurring: customRecurring,
  settings: { ...INITIAL_SETTINGS, quotaResetDay: 1 },
  nowMs: 1700000000000,
});
assert.equal(step1.result.recurringIncomeTotal, 0);
assert.equal(step1.result.quotaResetCount, 1);
assert.equal(step1.result.billsPaid, 1); // 2025-04-01 Netflix (419) paid from 1000
assert.equal(step1.result.billsSkipped, 1); // 2025-04-05 Condo (11500) skipped (balance 581)
assert.equal(step1.bankBalance, 581);

const step2 = simulateRolloverToDate({
  targetDate: "2025-04-28",
  bankBalance: step1.bankBalance,
  recurring: step1.updatedRecurring,
  settings: { ...INITIAL_SETTINGS, quotaResetDay: 1, ...step1.settingsPatch },
  nowMs: 1700000001000,
});
assert.equal(step2.result.recurringIncomeCount, 1);
assert.equal(step2.result.recurringIncomeTotal, 30000);
assert.equal(step2.result.billsSkipped, 2); // 04-05 Condo & 04-10 AIS due before 04-25 salary
assert.equal(step2.result.billsPaid, 1); // 04-28 bill (2000) paid after 04-25 salary arrives
assert.equal(step2.bankBalance, 28581);
assert.equal(step2.result.quotaResetCount, 0);

const step3 = simulateRolloverToDate({
  targetDate: "2025-04-30",
  bankBalance: step2.bankBalance,
  recurring: step2.updatedRecurring,
  settings: { ...INITIAL_SETTINGS, quotaResetDay: 1, ...step2.settingsPatch },
  nowMs: 1700000002000,
});
assert.equal(step3.result.recurringIncomeTotal, 0); // No duplicate salary in April

console.log("Finora self-check passed (14/14 checks)");
