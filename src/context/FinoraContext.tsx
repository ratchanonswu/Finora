"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import type {
  AppSettings,
  BankLedgerEntry,
  Category,
  ChatMessage,
  RecurringPayment,
  ThemeMode,
  Transaction,
  UserProfile,
} from "@/lib/types";
import {
  INITIAL_BANK_BALANCE,
  INITIAL_CATEGORIES,
  INITIAL_LEDGER,
  INITIAL_RECURRING,
  INITIAL_SETTINGS,
  INITIAL_TRANSACTIONS,
  INITIAL_USER,
  advanceDueDate,
  computeRecurringMonthlyBudget,
  isBaseCategory,
  normalizeTransactionDate,
  toDateInputValue,
  ymdToIso,
} from "@/lib/seed";
import { simulateRolloverToDate, type MonthlyRolloverResult } from "@/lib/rollover";

export type { MonthlyRolloverResult };

interface FinoraState {
  theme: ThemeMode;
  user: UserProfile;
  categories: Category[];
  transactions: Transaction[];
  recurring: RecurringPayment[];
  bankBalance: number;
  ledger: BankLedgerEntry[];
  settings: AppSettings;
}

interface FinoraContextValue extends FinoraState {
  hydrated: boolean;
  isTxModalOpen: boolean;
  setTxModalOpen: (open: boolean) => void;
  toggleTheme: () => void;
  loginUser: (email: string, name?: string) => void;
  registerUser: (email: string, name: string) => void;
  logoutUser: () => void;
  addTransaction: (
    tx: Omit<Transaction, "id" | "ref" | "status">
  ) => Promise<{ ok: boolean; error?: string; transactionId?: string }>;
  updateTransactionDate: (id: string, dateYmd: string) => void;
  deleteTransaction: (id: string, options?: { refundWallet?: boolean }) => Promise<void>;
  chatMessages: ChatMessage[];
  appendChatMessage: (msg: ChatMessage) => void;
  updateChatMessage: (id: string, patch: Partial<ChatMessage>) => void;
  clearChatMessages: () => void;
  undoChatTransaction: (messageId: string) => Promise<void>;
  addCategory: (cat: Omit<Category, "id">) => Category;
  deleteCategory: (id: string) => void;
  updateCategoryBudget: (id: string, budget: number) => void;
  addRecurring: (rec: Omit<RecurringPayment, "id">) => void;
  toggleRecurring: (id: string) => void;
  deleteRecurring: (id: string) => void;
  updateRecurringDate: (id: string, nextDueDate: string) => void;
  payRecurringItem: (id: string) => Promise<{ ok: boolean; error?: string }>;
  payAllActiveRecurring: (targetType?: "expense" | "income") => Promise<{
    ok: boolean;
    error?: string;
    count?: number;
    total?: number;
  }>;
  executeBankAction: (
    type: "credit" | "debit",
    amount: number,
    title: string,
    counterparty: string
  ) => Promise<{ ok: boolean; error?: string }>;
  updateSettings: (patch: Partial<AppSettings>) => void;
  updateUser: (patch: Partial<UserProfile>) => void;
  runMonthlyRollover: (targetDate?: string) => MonthlyRolloverResult;
}

const STORAGE_KEY = "finora_state_v1";
const CHAT_SESSION_KEY = "finora_chat_session_v1";

function chatSessionKeyFor(email: string): string {
  return `${CHAT_SESSION_KEY}:${email.trim().toLowerCase()}`;
}

function loadUserChatSession(email: string): ChatMessage[] {
  if (!email.trim()) return INITIAL_CHAT_MESSAGES;
  try {
    const savedChat = sessionStorage.getItem(chatSessionKeyFor(email));
    if (savedChat) {
      const parsedChat = JSON.parse(savedChat) as ChatMessage[];
      if (Array.isArray(parsedChat) && parsedChat.length > 0) {
        return parsedChat;
      }
    }
  } catch {
    // Ignore malformed sessionStorage and fall back to welcome message
  }
  return INITIAL_CHAT_MESSAGES;
}

const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    text: "สวัสดีค่ะ ฟิโนร่า (Finora AI) ผู้ช่วยการเงินส่วนตัวของคุณเองค่ะ สามารถถามคำถามการเงิน หรือส่งรูป QR Code / สลิปโอนเงิน เพื่อให้ฟิโนร่าตรวจสอบ จัดหมวดหมู่ และบันทึกรายรับ-รายจ่ายให้อัตโนมัติได้เลยนะคะ",
  },
];

function syncCategoriesWithRecurring(
  categories: Category[],
  recurring: RecurringPayment[]
): Category[] {
  const recurringBudget = computeRecurringMonthlyBudget(recurring);
  const seedRecurring = INITIAL_CATEGORIES.find((c) => c.id === "recurring");
  const hasRecurringCat = categories.some((c) => c.id === "recurring");
  if (!hasRecurringCat && seedRecurring) {
    const expenseInsertIdx = categories.findIndex((c) => c.type === "income");
    const nextCat = { ...seedRecurring, budget: recurringBudget };
    if (expenseInsertIdx === -1) return [...categories, nextCat];
    return [
      ...categories.slice(0, expenseInsertIdx),
      nextCat,
      ...categories.slice(expenseInsertIdx),
    ];
  }
  return categories.map((c) => (c.id === "recurring" ? { ...c, budget: recurringBudget } : c));
}

function sortTransactionsByDateDesc(list: Transaction[]): Transaction[] {
  return [...list].sort((a, b) => {
    const dayDiff = toDateInputValue(b.date).localeCompare(toDateInputValue(a.date));
    if (dayDiff !== 0) return dayDiff;
    const tb = new Date(b.date).getTime();
    const ta = new Date(a.date).getTime();
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  });
}

const DEFAULT_STATE: FinoraState = {
  theme: "light",
  user: INITIAL_USER,
  categories: INITIAL_CATEGORIES,
  transactions: sortTransactionsByDateDesc(INITIAL_TRANSACTIONS),
  recurring: INITIAL_RECURRING,
  bankBalance: INITIAL_BANK_BALANCE,
  ledger: INITIAL_LEDGER,
  settings: INITIAL_SETTINGS,
};

const FinoraContext = createContext<FinoraContextValue | null>(null);

export function FinoraProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FinoraState>(DEFAULT_STATE);
  const bankBalanceRef = useRef(state.bankBalance);
  bankBalanceRef.current = state.bankBalance;
  const txSeqRef = useRef(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(INITIAL_CHAT_MESSAGES);
  const [hydrated, setHydrated] = useState(false);
  const [isTxModalOpen, setTxModalOpen] = useState(false);

  useEffect(() => {
    try {
      // Remove legacy un-scoped chat key so older sessions cannot leak across users.
      sessionStorage.removeItem(CHAT_SESSION_KEY);
      let activeUser = DEFAULT_STATE.user;
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<FinoraState>;
        const hasLegacy2025Seed =
          (Array.isArray(parsed.recurring) &&
            parsed.recurring.some((r) => String(r.nextDueDate || "").startsWith("2025-"))) ||
          (Array.isArray(parsed.transactions) &&
            parsed.transactions.some((t) => String(t.date || "").startsWith("2025-")));

        if (hasLegacy2025Seed) {
          parsed.categories = DEFAULT_STATE.categories;
          parsed.transactions = DEFAULT_STATE.transactions;
          parsed.recurring = DEFAULT_STATE.recurring;
          parsed.bankBalance = DEFAULT_STATE.bankBalance;
          parsed.ledger = DEFAULT_STATE.ledger;
          parsed.settings = {
            ...INITIAL_SETTINGS,
            geminiApiKeyOverride: parsed.settings?.geminiApiKeyOverride || "",
          };
        }

        // Saved demo data predates the per-category palette; refresh seed category colors.
        if (Array.isArray(parsed.categories)) {
          parsed.categories = parsed.categories.map((c) => {
            const seed = INITIAL_CATEGORIES.find((s) => s.id === c.id);
            return seed ? { ...c, color: seed.color } : c;
          });
        } else {
          delete parsed.categories;
        }
        if (Array.isArray(parsed.recurring)) {
          parsed.recurring = parsed.recurring.map((r) => ({
            ...r,
            categoryId: (r.type ?? "expense") === "income" ? r.categoryId || "salary" : "recurring",
          }));
        } else {
          delete parsed.recurring;
        }
        if (Array.isArray(parsed.transactions)) {
          parsed.transactions = sortTransactionsByDateDesc(parsed.transactions);
        } else {
          delete parsed.transactions;
        }
        if (!Array.isArray(parsed.ledger)) delete parsed.ledger;

        const loadedRecurring = parsed.recurring ?? DEFAULT_STATE.recurring;
        parsed.categories = syncCategoriesWithRecurring(
          parsed.categories ?? DEFAULT_STATE.categories,
          loadedRecurring
        );
        const mergedUser: UserProfile = {
          ...INITIAL_USER,
          ...(parsed.user && typeof parsed.user === "object" ? parsed.user : {}),
          isLoggedIn: Boolean(parsed.user?.isLoggedIn),
        };
        activeUser = mergedUser;
        setState((prev) => ({
          ...prev,
          ...parsed,
          user: mergedUser,
          settings: { ...INITIAL_SETTINGS, ...(parsed.settings || {}) },
        }));
      }
      if (activeUser.isLoggedIn && activeUser.email) {
        setChatMessages(loadUserChatSession(activeUser.email));
      }
    } catch {
      // Ignore malformed storage and fall back to seed
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.classList.toggle("dark", state.theme === "dark");
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors
    }
  }, [state, hydrated]);

  useEffect(() => {
    if (!hydrated || !state.user.isLoggedIn || !state.user.email) return;
    try {
      sessionStorage.setItem(chatSessionKeyFor(state.user.email), JSON.stringify(chatMessages));
    } catch {
      // Ignore sessionStorage quota errors
    }
  }, [chatMessages, hydrated, state.user.isLoggedIn, state.user.email]);

  const toggleTheme = () =>
    setState((prev) => ({ ...prev, theme: prev.theme === "light" ? "dark" : "light" }));

  const loginUser = (email: string, name?: string) => {
    setState((prev) => {
      const isMockUser = email.toLowerCase() === INITIAL_USER.email.toLowerCase();
      return {
        ...prev,
        ...(isMockUser
          ? {
              categories: INITIAL_CATEGORIES,
              transactions: INITIAL_TRANSACTIONS,
              recurring: INITIAL_RECURRING,
              bankBalance: INITIAL_BANK_BALANCE,
              ledger: INITIAL_LEDGER,
            }
          : {}),
        user: {
          ...prev.user,
          email,
          name: isMockUser ? INITIAL_USER.name : name?.trim() || prev.user.name,
          isLoggedIn: true,
        },
      };
    });
    setChatMessages(loadUserChatSession(email));
  };

  // New registered users start with a clean account (no mock transactions/balance), keeping base categories.
  const registerUser = (email: string, name: string) => {
    setState((prev) => ({
      ...prev,
      categories: syncCategoriesWithRecurring(INITIAL_CATEGORIES, []),
      transactions: [],
      recurring: [],
      bankBalance: 0,
      ledger: [],
      user: {
        name: name.trim(),
        email,
        role: "",
        isLoggedIn: true,
      },
    }));
    setChatMessages(INITIAL_CHAT_MESSAGES);
    try {
      sessionStorage.removeItem(chatSessionKeyFor(email));
    } catch {
      // Ignore storage errors
    }
  };

  const logoutUser = () => {
    setState((prev) => ({
      ...prev,
      user: { ...prev.user, isLoggedIn: false },
    }));
    setChatMessages(INITIAL_CHAT_MESSAGES);
  };

  const executeBankAction = async (
    type: "credit" | "debit",
    amount: number,
    title: string,
    counterparty: string
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/virtual-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          amount,
          title,
          counterparty,
          currentBalance: bankBalanceRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || "ไม่สามารถทำรายการได้" };
      }
      bankBalanceRef.current = data.balance;
      setState((prev) => ({
        ...prev,
        bankBalance: data.balance,
        ledger: [data.entry, ...prev.ledger],
      }));
      return { ok: true };
    } catch {
      return { ok: false, error: "ไม่สามารถเชื่อมต่อบริการ Virtual Bank ได้" };
    }
  };

  const addTransaction = async (
    tx: Omit<Transaction, "id" | "ref" | "status">
  ): Promise<{ ok: boolean; error?: string; transactionId?: string }> => {
    if (tx.type === "expense" && state.settings.autoDebitOnExpense) {
      const bankRes = await executeBankAction(
        "debit",
        tx.amount,
        tx.title,
        tx.channel || "Finora Expense"
      );
      if (!bankRes.ok) return bankRes;
    } else if (tx.type === "income" && state.settings.autoDebitOnExpense) {
      const bankRes = await executeBankAction(
        "credit",
        tx.amount,
        tx.title,
        tx.channel || "Finora Income"
      );
      if (!bankRes.ok) return bankRes;
    }

    const now = Date.now();
    const seq = ++txSeqRef.current;
    const newTx: Transaction = {
      ...tx,
      id: `tx-${now}-${seq}`,
      ref: `TXN-${now.toString().slice(-6)}-${seq}`,
      status: "completed",
    };
    setState((prev) => ({
      ...prev,
      transactions: sortTransactionsByDateDesc([newTx, ...prev.transactions]),
    }));
    return { ok: true, transactionId: newTx.id };
  };

  const updateTransactionDate = (id: string, dateYmd: string) => {
    const normalized = normalizeTransactionDate(dateYmd);
    if (!normalized) return;
    const nextIso = ymdToIso(normalized);
    setState((prev) => ({
      ...prev,
      transactions: sortTransactionsByDateDesc(
        prev.transactions.map((t) => (t.id === id ? { ...t, date: nextIso } : t))
      ),
    }));
  };

  const deleteTransaction = async (
    id: string,
    options?: { refundWallet?: boolean }
  ): Promise<void> => {
    const refundWallet = options?.refundWallet ?? true;
    const target = state.transactions.find((t) => t.id === id);
    if (refundWallet && target && state.settings.autoDebitOnExpense && target.amount > 0) {
      const bankRes = await executeBankAction(
        target.type === "expense" ? "credit" : "debit",
        target.amount,
        `ลบรายการ: ${target.title}`,
        "Finora Delete Reversal"
      );
      if (!bankRes.ok) return;
    }
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }));
  };

  const appendChatMessage = (msg: ChatMessage) =>
    setChatMessages((prev) => [...prev, msg]);

  const updateChatMessage = (id: string, patch: Partial<ChatMessage>) =>
    setChatMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const clearChatMessages = () => {
    setChatMessages(INITIAL_CHAT_MESSAGES);
    try {
      if (state.user.email) {
        sessionStorage.removeItem(chatSessionKeyFor(state.user.email));
      }
      sessionStorage.removeItem(CHAT_SESSION_KEY);
    } catch {
      // Ignore storage errors
    }
  };

  const undoChatTransaction = async (messageId: string) => {
    const msg = chatMessages.find((m) => m.id === messageId);
    const action = msg?.txAction;
    if (!action || action.status !== "saved") return;

    if (state.settings.autoDebitOnExpense && action.amount > 0) {
      await executeBankAction(
        action.type === "expense" ? "credit" : "debit",
        action.amount,
        `ยกเลิกรายการ: ${action.merchant}`,
        "Finora AI Undo"
      );
    }

    if (action.transactionId) {
      await deleteTransaction(action.transactionId, { refundWallet: false });
    }

    updateChatMessage(messageId, {
      txAction: { ...action, status: "undone" },
    });
  };

  const addCategory = (cat: Omit<Category, "id">): Category => {
    const newCat: Category = { ...cat, id: `cat-${Date.now()}` };
    setState((prev) => ({
      ...prev,
      categories: [...prev.categories, newCat],
    }));
    return newCat;
  };

  const deleteCategory = (id: string) => {
    if (isBaseCategory(id)) return;
    setState((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c.id !== id),
      transactions: prev.transactions.map((t) =>
        t.categoryId === id ? { ...t, categoryId: t.type === "income" ? "salary" : "food" } : t
      ),
      recurring: prev.recurring.map((r) =>
        r.categoryId === id ? { ...r, categoryId: "food" } : r
      ),
    }));
  };

  const updateCategoryBudget = (id: string, budget: number) => {
    if (id === "recurring") return;
    setState((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.id === id ? { ...c, budget } : c)),
    }));
  };

  const addRecurring = (rec: Omit<RecurringPayment, "id">) =>
    setState((prev) => {
      const categoryId =
        (rec.type ?? "expense") === "income" ? rec.categoryId || "salary" : "recurring";
      const nextRecurring = [
        ...prev.recurring,
        { ...rec, categoryId, id: `rec-${Date.now()}` },
      ];
      return {
        ...prev,
        recurring: nextRecurring,
        categories: syncCategoriesWithRecurring(prev.categories, nextRecurring),
      };
    });

  const toggleRecurring = (id: string) =>
    setState((prev) => {
      const nextRecurring = prev.recurring.map((r) =>
        r.id === id ? { ...r, active: !r.active } : r
      );
      return {
        ...prev,
        recurring: nextRecurring,
        categories: syncCategoriesWithRecurring(prev.categories, nextRecurring),
      };
    });

  const deleteRecurring = (id: string) =>
    setState((prev) => {
      const nextRecurring = prev.recurring.filter((r) => r.id !== id);
      return {
        ...prev,
        recurring: nextRecurring,
        categories: syncCategoriesWithRecurring(prev.categories, nextRecurring),
      };
    });

  const updateRecurringDate = (id: string, nextDueDate: string) =>
    setState((prev) => ({
      ...prev,
      recurring: prev.recurring.map((r) => (r.id === id ? { ...r, nextDueDate } : r)),
    }));

  const payRecurringItem = async (id: string): Promise<{ ok: boolean; error?: string }> => {
    const item = state.recurring.find((r) => r.id === id);
    if (!item) return { ok: false, error: "ไม่พบรายการอัตโนมัติ" };

    const isIncome = (item.type ?? "expense") === "income";

    if (state.settings.autoDebitOnExpense) {
      const bankRes = await executeBankAction(
        isIncome ? "credit" : "debit",
        item.amount,
        isIncome ? `รับรายรับประจำ: ${item.title}` : `ชำระรายจ่ายประจำ: ${item.title}`,
        item.title
      );
      if (!bankRes.ok) return bankRes;
    }

    const nowMs = Date.now();
    const newTx: Transaction = {
      id: `tx-rec-${nowMs}`,
      ref: `${isIncome ? "INC" : "REC"}-${nowMs.toString().slice(-6)}`,
      title: item.title,
      amount: item.amount,
      type: isIncome ? "income" : "expense",
      categoryId: isIncome ? item.categoryId || "salary" : "recurring",
      channel: isIncome
        ? "รับยอดรายรับประจำ (Recurring)"
        : "ตัดยอดรายจ่ายประจำ (Recurring)",
      date: new Date(nowMs).toISOString(),
      status: "completed",
    };

    setState((prev) => ({
      ...prev,
      transactions: sortTransactionsByDateDesc([newTx, ...prev.transactions]),
      recurring: prev.recurring.map((r) =>
        r.id === id ? { ...r, nextDueDate: advanceDueDate(r.nextDueDate, r.cycle) } : r
      ),
    }));

    return { ok: true };
  };

  const payAllActiveRecurring = async (
    targetType: "expense" | "income" = "expense"
  ): Promise<{
    ok: boolean;
    error?: string;
    count?: number;
    total?: number;
  }> => {
    const activeItems = state.recurring.filter(
      (r) => r.active && (r.type ?? "expense") === targetType
    );
    if (activeItems.length === 0) {
      return { ok: false, error: "ไม่มีรายการที่เปิดใช้งานอยู่" };
    }

    const isIncome = targetType === "income";
    const total = activeItems.reduce((sum, r) => sum + r.amount, 0);
    const batchTitle = isIncome
      ? `รับรายรับประจำรวม (${activeItems.length} รายการ)`
      : `ชำระรายจ่ายประจำรวม (${activeItems.length} รายการ)`;

    if (state.settings.autoDebitOnExpense && total > 0) {
      const bankRes = await executeBankAction(
        isIncome ? "credit" : "debit",
        total,
        batchTitle,
        isIncome ? "Recurring Income Batch" : "Recurring Batch"
      );
      if (!bankRes.ok) return bankRes;
    }

    const nowMs = Date.now();
    const newTx: Transaction = {
      id: `tx-rec-batch-${nowMs}`,
      ref: `${isIncome ? "INC" : "REC"}-${nowMs.toString().slice(-6)}`,
      title: batchTitle,
      amount: total,
      type: isIncome ? "income" : "expense",
      categoryId: isIncome ? "salary" : "recurring",
      channel: isIncome
        ? "รับยอดรายรับประจำรวม (Recurring)"
        : "ตัดยอดรายจ่ายประจำรวม (Recurring)",
      date: new Date(nowMs).toISOString(),
      status: "completed",
    };

    setState((prev) => ({
      ...prev,
      transactions: sortTransactionsByDateDesc([newTx, ...prev.transactions]),
      recurring: prev.recurring.map((r) =>
        r.active && (r.type ?? "expense") === targetType
          ? { ...r, nextDueDate: advanceDueDate(r.nextDueDate, r.cycle) }
          : r
      ),
    }));

    return { ok: true, count: activeItems.length, total };
  };

  const updateSettings = (patch: Partial<AppSettings>) =>
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...patch },
    }));

  const updateUser = (patch: Partial<UserProfile>) =>
    setState((prev) => ({
      ...prev,
      user: { ...prev.user, ...patch },
    }));

  const runMonthlyRollover = (targetDate?: string): MonthlyRolloverResult => {
    const resolvedDate =
      targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)
        ? targetDate
        : new Date().toISOString().slice(0, 10);

    const out = simulateRolloverToDate({
      targetDate: resolvedDate,
      bankBalance: bankBalanceRef.current,
      recurring: state.recurring,
      settings: state.settings,
    });

    bankBalanceRef.current = out.bankBalance;
    setState((prev) => ({
      ...prev,
      bankBalance: out.bankBalance,
      transactions: sortTransactionsByDateDesc([...out.newTransactions, ...prev.transactions]),
      ledger: [...out.newLedger, ...prev.ledger],
      recurring: out.updatedRecurring,
      settings: {
        ...prev.settings,
        ...out.settingsPatch,
      },
    }));

    return out.result;
  };

  return (
    <FinoraContext.Provider
      value={{
        ...state,
        hydrated,
        isTxModalOpen,
        setTxModalOpen,
        toggleTheme,
        loginUser,
        registerUser,
        logoutUser,
        addTransaction,
        updateTransactionDate,
        deleteTransaction,
        chatMessages,
        appendChatMessage,
        updateChatMessage,
        clearChatMessages,
        undoChatTransaction,
        addCategory,
        deleteCategory,
        updateCategoryBudget,
        addRecurring,
        toggleRecurring,
        deleteRecurring,
        updateRecurringDate,
        payRecurringItem,
        payAllActiveRecurring,
        executeBankAction,
        updateSettings,
        updateUser,
        runMonthlyRollover,
      }}
    >
      {children}
    </FinoraContext.Provider>
  );
}

export function useFinora() {
  const ctx = useContext(FinoraContext);
  if (!ctx) throw new Error("useFinora must be used inside FinoraProvider");
  return ctx;
}
