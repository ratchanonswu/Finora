export type ThemeMode = "light" | "dark";

export type TransactionType = "income" | "expense";

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  budget: number;
  type: TransactionType;
}

export interface Transaction {
  id: string;
  ref: string;
  title: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  channel: string;
  date: string; // ISO string
  note?: string;
  status: "completed" | "pending";
}

export interface RecurringPayment {
  id: string;
  title: string;
  amount: number;
  categoryId: string;
  cycle: "monthly" | "weekly" | "yearly";
  nextDueDate: string; // YYYY-MM-DD
  active: boolean;
  icon: string;
}

export interface BankLedgerEntry {
  id: string;
  ref: string;
  type: "credit" | "debit";
  title: string;
  counterparty: string;
  amount: number;
  balanceAfter: number;
  date: string;
}

export interface UserProfile {
  name: string;
  email: string;
  role: string;
  isLoggedIn: boolean;
}

export interface AppSettings {
  currency: "THB" | "USD";
  autoDebitOnExpense: boolean;
  pinConfirmThreshold: number;
  notifyUpcomingBills: boolean;
  notifyBudget80: boolean;
  aiAutoCategorize: boolean;
  aiConfidenceThreshold: number;
  geminiApiKeyOverride: string;
}

export interface ChatTxAction {
  transactionId?: string;
  status: "saved" | "needs_amount" | "undone";
  type: TransactionType;
  merchant: string;
  promptPayId: string;
  amount: number;
  categoryId: string;
}

export interface PendingToolCall {
  toolCallId: string;
  name: string;
  args: Record<string, unknown>;
  summary: string;
  status: "pending" | "confirmed" | "cancelled";
  continueAfterConfirm?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
  thumbnailUrl?: string;
  txAction?: ChatTxAction;
  pendingTool?: PendingToolCall;
}
