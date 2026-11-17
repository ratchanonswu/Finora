import type { OpenRouterToolDef } from "./openrouter.ts";
import type { Category, RecurringPayment, Transaction } from "./types.ts";

export interface FinancialSnapshot {
  bankBalance: number;
  transactions: Transaction[];
  categories: Category[];
  recurring: RecurringPayment[];
}

export const READ_TOOL_NAMES = new Set([
  "get_financial_overview",
  "get_transactions",
  "get_categories",
  "get_recurring_payments",
  "get_financial_prediction",
]);

export const WRITE_TOOL_NAMES = new Set([
  "add_transaction",
  "update_category_budget",
  "toggle_recurring",
  "virtual_bank_transfer",
]);

export const FINORA_TOOLS: OpenRouterToolDef[] = [
  {
    type: "function",
    function: {
      name: "get_financial_overview",
      description: "ดูยอดเงิน Virtual Bank คงเหลือ, รายรับรวม, รายจ่ายรวม, และยอดสุทธิปัจจุบัน",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_transactions",
      description: "ดึงรายการธุรกรรมล่าสุด สามารถกรองตามประเภทและหมวดหมู่ได้",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["all", "income", "expense"], description: "ประเภทรายการ" },
          categoryId: { type: "string", description: "รหัสหมวดหมู่ (เช่น food, shopping, salary)" },
          limit: { type: "number", description: "จำนวนรายการสูงสุด (ค่าเริ่มต้น 10)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_categories",
      description: "ดูรายการหมวดหมู่ทั้งหมดพร้อมยอดใช้จริงเทียบกับงบประมาณรายเดือน",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recurring_payments",
      description: "ดูรายการตัดเงินอัตโนมัติ (Recurring) ทั้งหมด สถานะ และวันครบกำหนดถัดไป",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_financial_prediction",
      description: "คำนวณคาดการณ์ยอดเงินและกระแสเงินสดในอนาคตล่วงหน้า พร้อมสมมติฐานและคำเตือนความเสี่ยง",
      parameters: {
        type: "object",
        properties: {
          monthsAhead: {
            type: "number",
            description: "จำนวนเดือนล่วงหน้าที่ต้องการคาดการณ์ (1 ถึง 12 เดือน, ค่าเริ่มต้น 3)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_transaction",
      description: "บันทึกรายรับหรือรายจ่ายใหม่ลงระบบ (ต้องรอผู้ใช้ยืนยัน)",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["income", "expense"] },
          title: { type: "string", description: "ชื่อรายการหรือร้านค้า" },
          amount: { type: "number", description: "จำนวนเงิน (บาท, มากกว่า 0)" },
          categoryId: { type: "string", description: "รหัสหมวดหมู่ เช่น food, shopping, salary" },
          channel: { type: "string", description: "ช่องทาง เช่น Virtual Bank Wallet, PromptPay QR" },
        },
        required: ["type", "title", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_category_budget",
      description: "ปรับงบประมาณรายเดือนของหมวดหมู่รายจ่าย (ต้องรอผู้ใช้ยืนยัน)",
      parameters: {
        type: "object",
        properties: {
          categoryId: { type: "string", description: "รหัสหมวดหมู่ เช่น food, shopping, housing" },
          budget: { type: "number", description: "งบประมาณใหม่ต่อเดือน (บาท)" },
        },
        required: ["categoryId", "budget"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "toggle_recurring",
      description: "เปิดใช้งานหรือพักรายการตัดเงินอัตโนมัติ (ต้องรอผู้ใช้ยืนยัน)",
      parameters: {
        type: "object",
        properties: {
          recurringId: { type: "string", description: "รหัสรายการ Recurring (เช่น rec-1)" },
        },
        required: ["recurringId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "virtual_bank_transfer",
      description: "เติมเงินเข้า (credit) หรือโอน/จ่ายออก (debit) ในบัญชี Virtual Bank (ต้องรอผู้ใช้ยืนยัน)",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["credit", "debit"] },
          amount: { type: "number", description: "จำนวนเงิน (บาท, มากกว่า 0)" },
          title: { type: "string", description: "รายละเอียดรายการ" },
          counterparty: { type: "string", description: "คู่ค้าหรือบัญชีปลายทาง" },
        },
        required: ["type", "amount", "title"],
      },
    },
  },
];

export function runReadTool(
  name: string,
  args: Record<string, unknown>,
  snapshot: FinancialSnapshot
): Record<string, unknown> {
  const { bankBalance, transactions, categories, recurring } = snapshot;

  if (name === "get_financial_overview") {
    const income = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return {
      virtualBankBalance: bankBalance,
      totalIncome: income,
      totalExpense: expense,
      netCashFlow: income - expense,
      transactionCount: transactions.length,
    };
  }

  if (name === "get_transactions") {
    const type = typeof args.type === "string" ? args.type : "all";
    const categoryId = typeof args.categoryId === "string" ? args.categoryId : "";
    const limit = Math.min(30, Math.max(1, Number(args.limit) || 10));
    const list = transactions
      .filter((t) => (type === "all" || t.type === type) && (!categoryId || t.categoryId === categoryId))
      .slice(0, limit)
      .map((t) => ({
        id: t.id,
        title: t.title,
        type: t.type,
        amount: t.amount,
        category: categories.find((c) => c.id === t.categoryId)?.name || t.categoryId,
        channel: t.channel,
        date: t.date,
      }));
    return { count: list.length, transactions: list };
  }

  if (name === "get_categories") {
    return {
      categories: categories.map((c) => {
        const spent = transactions
          .filter((t) => t.categoryId === c.id)
          .reduce((s, t) => s + t.amount, 0);
        return { id: c.id, name: c.name, type: c.type, budget: c.budget, spent };
      }),
    };
  }

  if (name === "get_recurring_payments") {
    const activeMonthlyTotal = recurring
      .filter((r) => r.active)
      .reduce((s, r) => s + (r.cycle === "yearly" ? r.amount / 12 : r.amount), 0);
    return {
      activeMonthlyTotal,
      items: recurring.map((r) => ({
        id: r.id,
        title: r.title,
        amount: r.amount,
        cycle: r.cycle,
        nextDueDate: r.nextDueDate,
        active: r.active,
      })),
    };
  }

  if (name === "get_financial_prediction") {
    const months = Math.min(12, Math.max(1, Math.round(Number(args.monthsAhead) || 3)));
    const income = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const activeRecurringMonthly = recurring
      .filter((r) => r.active)
      .reduce((s, r) => s + (r.cycle === "yearly" ? r.amount / 12 : r.amount), 0);

    // Avoid double-counting recurring items if they already appear in transactions; use whichever is higher as baseline outflow.
    const estimatedMonthlyOutflow = Math.max(expense, activeRecurringMonthly);
    const estimatedMonthlyNet = income - estimatedMonthlyOutflow;
    const projectedBalance = bankBalance + estimatedMonthlyNet * months;

    return {
      monthsAhead: months,
      currentBankBalance: bankBalance,
      baselineMonthlyIncome: income,
      baselineMonthlyOutflow: estimatedMonthlyOutflow,
      activeRecurringMonthly,
      estimatedMonthlyNet,
      projectedBalance,
      lowBalanceRisk: projectedBalance < activeRecurringMonthly,
      assumptions: [
        "คำนวณจากยอดรายรับและรายจ่ายที่บันทึกไว้ในระบบปัจจุบันเป็นฐานรายเดือน",
        `รวมภาระค่าบริการตัดอัตโนมัติ (Recurring) ที่เปิดใช้งานอยู่เดือนละ ${activeRecurringMonthly.toLocaleString("en-US")} บาท`,
        "สมมติให้พฤติกรรมการใช้จ่ายและรายรับคงที่ตลอดช่วงเวลาที่คาดการณ์",
      ],
    };
  }

  return { error: `Unknown read tool: ${name}` };
}

export function describeWriteTool(
  name: string,
  args: Record<string, unknown>,
  snapshot: FinancialSnapshot
): string {
  if (name === "add_transaction") {
    const typeLabel = args.type === "income" ? "รายรับ" : "รายจ่าย";
    const cat = snapshot.categories.find((c) => c.id === args.categoryId)?.name || String(args.categoryId || "ทั่วไป");
    return `บันทึก${typeLabel} "${String(args.title || "")}" จำนวน ฿${Number(args.amount || 0).toLocaleString("en-US")} (หมวดหมู่: ${cat})`;
  }
  if (name === "update_category_budget") {
    const cat = snapshot.categories.find((c) => c.id === args.categoryId)?.name || String(args.categoryId || "");
    return `ปรับงบประมาณหมวด "${cat}" เป็น ฿${Number(args.budget || 0).toLocaleString("en-US")}/เดือน`;
  }
  if (name === "toggle_recurring") {
    const rec = snapshot.recurring.find((r) => r.id === args.recurringId);
    const nextState = rec ? (rec.active ? "พักรายการ" : "เปิดใช้งาน") : "สลับสถานะ";
    return `${nextState} "${rec?.title || String(args.recurringId || "")}"`;
  }
  if (name === "virtual_bank_transfer") {
    const actionLabel = args.type === "credit" ? "เติมเงินเข้า Virtual Bank" : "โอนเงินออกจาก Virtual Bank";
    return `${actionLabel} จำนวน ฿${Number(args.amount || 0).toLocaleString("en-US")} (${String(args.title || "")})`;
  }
  return `ดำเนินการ ${name}`;
}
