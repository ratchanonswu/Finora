import assert from "node:assert/strict";
import { executeBankTransfer } from "./bank-service.ts";

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

console.log("Finora self-check passed (4/4 assertions)");
