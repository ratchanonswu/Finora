import type { BankLedgerEntry } from "./types.ts";
import { INITIAL_BANK_BALANCE, INITIAL_LEDGER } from "./seed.ts";

export interface BankTransferRequest {
  type: "credit" | "debit";
  amount: number;
  title: string;
  counterparty: string;
  currentBalance?: number;
}

export interface BankTransferResult {
  ok: boolean;
  error?: string;
  balance: number;
  entry?: BankLedgerEntry;
}

// Pure Virtual Bank balance & ledger transition so both API routes and tests share one source of truth.
export function executeBankTransfer(
  req: BankTransferRequest,
  serverBalance = INITIAL_BANK_BALANCE
): BankTransferResult {
  const baseBalance = typeof req.currentBalance === "number" ? req.currentBalance : serverBalance;

  if (!Number.isFinite(req.amount) || req.amount <= 0) {
    return { ok: false, error: "จำนวนเงินต้องมากกว่า 0 บาท", balance: baseBalance };
  }

  const nextBalance = req.type === "credit" ? baseBalance + req.amount : baseBalance - req.amount;
  const entry: BankLedgerEntry = {
    id: `l-${Date.now()}`,
    ref: `VB-${Date.now().toString().slice(-6)}`,
    type: req.type,
    title: req.title.trim() || (req.type === "credit" ? "เติมเงินเข้าบัญชี" : "ชำระเงิน / โอนออก"),
    counterparty: req.counterparty.trim() || "Finora Sandbox",
    amount: req.amount,
    balanceAfter: nextBalance,
    date: new Date().toISOString(),
  };

  return { ok: true, balance: nextBalance, entry };
}

export { INITIAL_BANK_BALANCE, INITIAL_LEDGER };
