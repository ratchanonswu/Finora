"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type {
  AppSettings,
  BankLedgerEntry,
  Category,
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
  logoutUser: () => void;
  addTransaction: (tx: Omit<Transaction, "id" | "ref" | "status">) => Promise<{ ok: boolean; error?: string }>;
  deleteTransaction: (id: string) => void;
  addCategory: (cat: Omit<Category, "id">) => void;
  updateCategoryBudget: (id: string, budget: number) => void;
  addRecurring: (rec: Omit<RecurringPayment, "id">) => void;
  toggleRecurring: (id: string) => void;
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
  const [hydrated, setHydrated] = useState(false);
  const [isTxModalOpen, setTxModalOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<FinoraState>;
        setState((prev) => ({ ...prev, ...parsed }));
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

  const toggleTheme = () =>
    setState((prev) => ({ ...prev, theme: prev.theme === "light" ? "dark" : "light" }));

  const loginUser = (email: string, name?: string) =>
    setState((prev) => ({
      ...prev,
      user: {
        ...prev.user,
        email,
        name: name?.trim() || prev.user.name,
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
  ): Promise<{ ok: boolean; error?: string }> => {
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
    return { ok: true };
  };

  const deleteTransaction = (id: string) =>
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }));

  const addCategory = (cat: Omit<Category, "id">) =>
    setState((prev) => ({
      ...prev,
      categories: [...prev.categories, { ...cat, id: `cat-${Date.now()}` }],
    }));

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
        logoutUser,
        addTransaction,
        deleteTransaction,
        addCategory,
        updateCategoryBudget,
        addRecurring,
        toggleRecurring,
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
