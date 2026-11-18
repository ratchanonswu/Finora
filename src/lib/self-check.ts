import assert from "node:assert/strict";
import { executeBankTransfer } from "./bank-service.ts";
import { getToolExecutionPriority, runReadTool, validateAndNormalizeWriteTool } from "./ai-tools.ts";
import { CATEGORY_PALETTE, INITIAL_CATEGORIES, INITIAL_RECURRING, INITIAL_TRANSACTIONS, isBaseCategory, nextCategoryColor, parsePromptPayPayload } from "./seed.ts";

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

console.log("Finora self-check passed (11/11 checks)");
