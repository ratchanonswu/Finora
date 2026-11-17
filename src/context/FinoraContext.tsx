"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
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
  isBaseCategory,
} from "@/lib/seed";

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
  deleteTransaction: (id: string) => void;
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
  executeBankAction: (
    type: "credit" | "debit",
    amount: number,
    title: string,
    counterparty: string
  ) => Promise<{ ok: boolean; error?: string }>;
  updateSettings: (patch: Partial<AppSettings>) => void;
  updateUser: (patch: Partial<UserProfile>) => void;
}

const STORAGE_KEY = "finora_state_v1";
const CHAT_SESSION_KEY = "finora_chat_session_v1";

const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    text: "สวัสดีค่ะ ฟิโนร่า (Finora AI) ผู้ช่วยการเงินส่วนตัวของคุณเองค่ะ สามารถถามคำถามการเงิน หรือส่งรูป QR Code / สลิปโอนเงิน เพื่อให้ฟิโนร่าตรวจสอบ จัดหมวดหมู่ และบันทึกรายรับ-รายจ่ายให้อัตโนมัติได้เลยนะคะ",
  },
];

const DEFAULT_STATE: FinoraState = {
  theme: "light",
  user: INITIAL_USER,
  categories: INITIAL_CATEGORIES,
  transactions: INITIAL_TRANSACTIONS,
  recurring: INITIAL_RECURRING,
  bankBalance: INITIAL_BANK_BALANCE,
  ledger: INITIAL_LEDGER,
  settings: INITIAL_SETTINGS,
};

const FinoraContext = createContext<FinoraContextValue | null>(null);

export function FinoraProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FinoraState>(DEFAULT_STATE);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(INITIAL_CHAT_MESSAGES);
  const [hydrated, setHydrated] = useState(false);
  const [isTxModalOpen, setTxModalOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<FinoraState>;
        // Saved demo data predates the per-category palette; refresh seed category colors.
        if (parsed.categories) {
          parsed.categories = parsed.categories.map((c) => {
            const seed = INITIAL_CATEGORIES.find((s) => s.id === c.id);
            return seed ? { ...c, color: seed.color } : c;
          });
        }
        setState((prev) => ({ ...prev, ...parsed }));
      }
      const savedChat = sessionStorage.getItem(CHAT_SESSION_KEY);
      if (savedChat) {
        const parsedChat = JSON.parse(savedChat) as ChatMessage[];
        if (Array.isArray(parsedChat) && parsedChat.length > 0) {
          setChatMessages(parsedChat);
        }
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
    if (!hydrated) return;
    try {
      sessionStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(chatMessages));
    } catch {
      // Ignore sessionStorage quota errors
    }
  }, [chatMessages, hydrated]);

  const toggleTheme = () =>
    setState((prev) => ({ ...prev, theme: prev.theme === "light" ? "dark" : "light" }));

  const loginUser = (email: string, name?: string) =>
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

  // New registered users start with a clean account (no mock transactions/balance), keeping base categories.
  const registerUser = (email: string, name: string) =>
    setState((prev) => ({
      ...prev,
      categories: INITIAL_CATEGORIES,
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

  const logoutUser = () =>
    setState((prev) => ({
      ...prev,
      user: { ...prev.user, isLoggedIn: false },
    }));

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
          currentBalance: state.bankBalance,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || "ไม่สามารถทำรายการได้" };
      }
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
      await executeBankAction("credit", tx.amount, tx.title, tx.channel || "Finora Income");
    }

    const newTx: Transaction = {
      ...tx,
      id: `tx-${Date.now()}`,
      ref: `TXN-${Date.now().toString().slice(-6)}`,
      status: "completed",
    };
    setState((prev) => ({
      ...prev,
      transactions: [newTx, ...prev.transactions],
    }));
    return { ok: true, transactionId: newTx.id };
  };

  const deleteTransaction = (id: string) =>
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }));

  const appendChatMessage = (msg: ChatMessage) =>
    setChatMessages((prev) => [...prev, msg]);

  const updateChatMessage = (id: string, patch: Partial<ChatMessage>) =>
    setChatMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const clearChatMessages = () => {
    setChatMessages(INITIAL_CHAT_MESSAGES);
    try {
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
      deleteTransaction(action.transactionId);
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

  const updateCategoryBudget = (id: string, budget: number) =>
    setState((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.id === id ? { ...c, budget } : c)),
    }));

  const addRecurring = (rec: Omit<RecurringPayment, "id">) =>
    setState((prev) => ({
      ...prev,
      recurring: [...prev.recurring, { ...rec, id: `rec-${Date.now()}` }],
    }));

  const toggleRecurring = (id: string) =>
    setState((prev) => ({
      ...prev,
      recurring: prev.recurring.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
    }));

  const deleteRecurring = (id: string) =>
    setState((prev) => ({
      ...prev,
      recurring: prev.recurring.filter((r) => r.id !== id),
    }));

  const updateRecurringDate = (id: string, nextDueDate: string) =>
    setState((prev) => ({
      ...prev,
      recurring: prev.recurring.map((r) => (r.id === id ? { ...r, nextDueDate } : r)),
    }));

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
        executeBankAction,
        updateSettings,
        updateUser,
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
