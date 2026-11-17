import type { OpenRouterToolDef } from "./openrouter.ts";
import { nextCategoryColor } from "./seed.ts";
import type { Category, RecurringPayment, Transaction, TransactionType } from "./types.ts";

export interface FinancialSnapshot {
  bankBalance: number;
  transactions: Transaction[];
  categories: Category[];
  recurring: RecurringPayment[];
  autoDebitOnExpense?: boolean;
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
  "add_category",
  "update_category_budget",
  "add_recurring_payment",
  "toggle_recurring",
  "virtual_bank_transfer",
]);

const VALID_CATEGORY_ICONS = new Set([
  "label",
  "fitness_center",
  "school",
  "pets",
  "flight",
  "medical_services",
  "card_giftcard",
  "work",
  "restaurant",
  "shopping_bag",
  "home",
  "directions_car",
  "subscriptions",
  "payments",
  "show_chart",
]);

function pickCategoryIcon(name: string, rawIcon?: unknown): string {
  if (typeof rawIcon === "string" && VALID_CATEGORY_ICONS.has(rawIcon)) {
    return rawIcon;
  }
  const lower = name.toLowerCase();
  if (/สัตว์|แมว|หมา|pet|dog|cat/.test(lower)) return "pets";
  if (/สุขภาพ|ฟิตเนส|ยิม|ออกกำลัง|gym|fit/.test(lower)) return "fitness_center";
  if (/เรียน|ศึกษา|หนังสือ|คอร์ส|school|study|book/.test(lower)) return "school";
  if (/เที่ยว|บิน|โรงแรม|ทริป|flight|travel|trip/.test(lower)) return "flight";
  if (/หมอ|ยา|พยาบาล|คลินิก|medical|health|hospital/.test(lower)) return "medical_services";
  if (/ของขวัญ|บริจาค|ทำบุญ|gift|donate/.test(lower)) return "card_giftcard";
  if (/งาน|ฟรีแลนซ์|จ๊อบ|work|freelance/.test(lower)) return "work";
  return "label";
}

function defaultNextMonthFirstDay(): string {
  const now = new Date();
  const y = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const m = String(((now.getMonth() + 1) % 12) + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

const CATEGORY_ALIASES: Record<string, string> = {
  transportation: "transport",
  travel: "transport",
  transit: "transport",
  commute: "transport",
  bts: "transport",
  mrt: "transport",
  grab: "transport",
  taxi: "transport",
  fuel: "transport",
  เดินทาง: "transport",
  น้ำมัน: "transport",
  dining: "food",
  drink: "food",
  drinks: "food",
  coffee: "food",
  restaurant: "food",
  อาหาร: "food",
  เครื่องดื่ม: "food",
  shop: "shopping",
  lifestyle: "shopping",
  ช้อปปิ้ง: "shopping",
  house: "housing",
  home: "housing",
  rent: "housing",
  bill: "housing",
  bills: "housing",
  utility: "housing",
  utilities: "housing",
  บิล: "housing",
  ที่อยู่อาศัย: "housing",
  movie: "entertainment",
  subscription: "entertainment",
  subscriptions: "entertainment",
  game: "entertainment",
  บันเทิง: "entertainment",
  wage: "salary",
  bonus: "salary",
  income: "salary",
  เงินเดือน: "salary",
  invest: "investment",
  dividend: "investment",
  stock: "investment",
  ปันผล: "investment",
  ลงทุน: "investment",
};

export function resolveCategory(
  raw: unknown,
  categories: Category[],
  expectedType?: TransactionType,
  fallbackText?: string
): Category | null {
  const pool = expectedType ? categories.filter((c) => c.type === expectedType) : categories;
  const candidates = [String(raw || "").trim(), String(fallbackText || "").trim()].filter(Boolean);

  for (const input of candidates) {
    const lower = input.toLowerCase();
    const exactId = pool.find((c) => c.id.toLowerCase() === lower);
    if (exactId) return exactId;

    const mappedId = CATEGORY_ALIASES[lower];
    if (mappedId) {
      const mapped = pool.find((c) => c.id === mappedId);
      if (mapped) return mapped;
    }

    const byName = pool.find(
      (c) => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase())
    );
    if (byName) return byName;

    for (const [aliasKey, targetId] of Object.entries(CATEGORY_ALIASES)) {
      if (lower.includes(aliasKey)) {
        const hit = pool.find((c) => c.id === targetId);
        if (hit) return hit;
      }
    }
  }

  return null;
}

export function resolveRecurring(
  raw: unknown,
  recurring: RecurringPayment[]
): RecurringPayment | null {
  const key = String(raw || "").trim().toLowerCase();
  if (!key) return null;
  return (
    recurring.find((r) => r.id.toLowerCase() === key) ||
    recurring.find(
      (r) => r.title.toLowerCase().includes(key) || key.includes(r.title.toLowerCase())
    ) ||
    null
  );
}

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
          categoryId: {
            type: "string",
            description:
              "รหัสหมวดหมู่ที่มีจริงในระบบ (food, shopping, housing, transport, entertainment, salary, investment หรือ cat-...)",
          },
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
      description:
        "คำนวณคาดการณ์ยอดเงินและกระแสเงินสดในอนาคตล่วงหน้า พร้อมสมมติฐานและคำเตือนความเสี่ยง",
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
          categoryId: {
            type: "string",
            description:
              "รหัสหมวดหมู่ที่มีจริงในระบบเท่านั้น: รายจ่ายใช้ food, shopping, housing, transport, entertainment / รายรับใช้ salary, investment (หรือรหัสหมวดใน Context)",
          },
          channel: {
            type: "string",
            description: "ช่องทาง เช่น Virtual Bank Wallet, PromptPay QR",
          },
        },
        required: ["type", "title", "amount", "categoryId"],
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
          categoryId: {
            type: "string",
            description:
              "รหัสหมวดหมู่รายจ่ายที่มีจริงในระบบ เช่น food, shopping, housing, transport, entertainment",
          },
          budget: { type: "number", description: "งบประมาณใหม่ต่อเดือน (บาท, >= 0)" },
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
          recurringId: {
            type: "string",
            description: "รหัสรายการ Recurring (เช่น rec-1) หรือชื่อรายการ",
          },
        },
        required: ["recurringId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "virtual_bank_transfer",
      description:
        "เติมเงินเข้า (credit) หรือโอน/จ่ายออก (debit) ในบัญชี Virtual Bank (ต้องรอผู้ใช้ยืนยัน)",
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
  {
    type: "function",
    function: {
      name: "add_category",
      description: "สร้างหมวดหมู่รายจ่ายหรือรายรับใหม่ (ต้องรอผู้ใช้ยืนยัน)",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "ชื่อหมวดหมู่ใหม่ เช่น สัตว์เลี้ยง, สุขภาพ & ฟิตเนส" },
          type: { type: "string", enum: ["expense", "income"], description: "ประเภทหมวดหมู่ (ค่าเริ่มต้น expense)" },
          budget: { type: "number", description: "งบประมาณต่อเดือน (บาท, >= 0, สำหรับหมวดรายจ่าย)" },
          icon: {
            type: "string",
            enum: ["label", "fitness_center", "school", "pets", "flight", "medical_services", "card_giftcard", "work"],
            description: "ไอคอนของหมวดหมู่",
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_recurring_payment",
      description: "สร้างรายการตัดเงินอัตโนมัติ (Recurring) ใหม่ (ต้องรอผู้ใช้ยืนยัน)",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "ชื่อบริการหรือบิล เช่น YouTube Premium, ค่าอินเทอร์เน็ต" },
          amount: { type: "number", description: "จำนวนเงินต่อรอบ (บาท, มากกว่า 0)" },
          categoryId: {
            type: "string",
            description: "รหัสหมวดหมู่รายจ่ายที่มีในระบบ เช่น entertainment, housing, food, shopping, transport",
          },
          cycle: {
            type: "string",
            enum: ["monthly", "weekly", "yearly"],
            description: "รอบการตัดเงิน (ค่าเริ่มต้น monthly)",
          },
          nextDueDate: {
            type: "string",
            description: "วันครบกำหนดถัดไปในรูปแบบ YYYY-MM-DD (ถ้าไม่ระบุจะใช้วันที่ 1 ของเดือนถัดไป)",
          },
        },
        required: ["title", "amount"],
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
    const categoryId = args.categoryId
      ? resolveCategory(args.categoryId, categories)?.id || String(args.categoryId)
      : "";
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
    const cat =
      snapshot.categories.find((c) => c.id === args.categoryId)?.name ||
      String(args.categoryId || "");
    return `บันทึก${typeLabel} "${String(args.title || "")}" จำนวน ฿${Number(args.amount || 0).toLocaleString("en-US")} (หมวดหมู่: ${cat})`;
  }
  if (name === "update_category_budget") {
    const cat =
      snapshot.categories.find((c) => c.id === args.categoryId)?.name ||
      String(args.categoryId || "");
    return `ปรับงบประมาณหมวด "${cat}" เป็น ฿${Number(args.budget || 0).toLocaleString("en-US")}/เดือน`;
  }
  if (name === "toggle_recurring") {
    const rec = snapshot.recurring.find((r) => r.id === args.recurringId);
    const nextState = rec ? (rec.active ? "พักรายการ" : "เปิดใช้งาน") : "สลับสถานะ";
    return `${nextState} "${rec?.title || String(args.recurringId || "")}"`;
  }
  if (name === "virtual_bank_transfer") {
    const actionLabel =
      args.type === "credit" ? "เติมเงินเข้า Virtual Bank" : "โอนเงินออกจาก Virtual Bank";
    return `${actionLabel} จำนวน ฿${Number(args.amount || 0).toLocaleString("en-US")} (${String(args.title || "")})`;
  }
  if (name === "add_category") {
    const typeLabel = args.type === "income" ? "หมวดรายรับ" : "หมวดรายจ่าย";
    const budgetText =
      args.type === "income" ? "" : ` งบ ฿${Number(args.budget || 0).toLocaleString("en-US")}/เดือน`;
    return `สร้าง${typeLabel}ใหม่ "${String(args.name || "")}"${budgetText}`;
  }
  if (name === "add_recurring_payment") {
    const cycleLabel =
      args.cycle === "weekly" ? "รายสัปดาห์" : args.cycle === "yearly" ? "รายปี" : "รายเดือน";
    const cat =
      snapshot.categories.find((c) => c.id === args.categoryId)?.name ||
      String(args.categoryId || "");
    return `เพิ่มรายการตัดเงินอัตโนมัติ "${String(args.title || "")}" ฿${Number(args.amount || 0).toLocaleString("en-US")} (${cycleLabel}, หมวด: ${cat}, ครบกำหนด: ${String(args.nextDueDate || "")})`;
  }
  return `ดำเนินการ ${name}`;
}

export function validateAndNormalizeWriteTool(
  name: string,
  rawArgs: Record<string, unknown>,
  snapshot: FinancialSnapshot
): { ok: true; args: Record<string, unknown>; summary: string } | { ok: false; error: string } {
  const { bankBalance, categories, recurring, autoDebitOnExpense = true } = snapshot;

  if (name === "add_transaction") {
    const txType: TransactionType = rawArgs.type === "income" ? "income" : "expense";
    const title = String(rawArgs.title || "").trim();
    const amount = Number(rawArgs.amount);

    if (!title) {
      return { ok: false, error: "ต้องระบุชื่อรายการ (title)" };
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: "จำนวนเงิน (amount) ต้องเป็นตัวเลขที่มากกว่า 0 บาท" };
    }
    if (txType === "expense" && autoDebitOnExpense && amount > bankBalance) {
      return {
        ok: false,
        error: `ยอดเงินใน Virtual Wallet คงเหลือ ฿${bankBalance.toLocaleString("en-US")} ไม่เพียงพอสำหรับรายจ่าย ฿${amount.toLocaleString("en-US")}`,
      };
    }

    const rawCat = String(rawArgs.categoryId || "").trim();
    const cat = rawCat
      ? resolveCategory(rawCat, categories, txType)
      : resolveCategory("", categories, txType, title);

    if (!cat) {
      const validList = categories
        .filter((c) => c.type === txType)
        .map((c) => `${c.id} (${c.name})`)
        .join(", ");
      return {
        ok: false,
        error: `ไม่พบหมวดหมู่ "${rawCat}" สำหรับ${txType === "income" ? "รายรับ" : "รายจ่าย"} หมวดหมู่ที่มีในระบบคือ: ${validList}`,
      };
    }

    const normalized = {
      type: txType,
      title,
      amount,
      categoryId: cat.id,
      channel: String(rawArgs.channel || "Virtual Bank Wallet").trim(),
    };
    return {
      ok: true,
      args: normalized,
      summary: describeWriteTool(name, normalized, snapshot),
    };
  }

  if (name === "update_category_budget") {
    const budget = Number(rawArgs.budget);
    if (!Number.isFinite(budget) || budget < 0) {
      return { ok: false, error: "งบประมาณ (budget) ต้องเป็นตัวเลขตั้งแต่ 0 บาทขึ้นไป" };
    }
    const cat = resolveCategory(rawArgs.categoryId, categories, "expense");
    if (!cat) {
      const validExpenseCats = categories
        .filter((c) => c.type === "expense")
        .map((c) => `${c.id} (${c.name})`)
        .join(", ");
      return {
        ok: false,
        error: `ไม่พบหมวดหมู่รายจ่าย "${String(rawArgs.categoryId || "")}" หมวดหมู่รายจ่ายที่ตั้งงบได้คือ: ${validExpenseCats}`,
      };
    }

    const normalized = { categoryId: cat.id, budget };
    return {
      ok: true,
      args: normalized,
      summary: describeWriteTool(name, normalized, snapshot),
    };
  }

  if (name === "toggle_recurring") {
    const rec = resolveRecurring(rawArgs.recurringId, recurring);
    if (!rec) {
      const validRecs =
        recurring.map((r) => `${r.id} (${r.title})`).join(", ") ||
        "ไม่มีรายการตัดเงินอัตโนมัติในระบบ";
      return {
        ok: false,
        error: `ไม่พบรายการตัดเงินอัตโนมัติ "${String(rawArgs.recurringId || "")}" รายการที่มีในระบบคือ: ${validRecs}`,
      };
    }

    const normalized = { recurringId: rec.id };
    return {
      ok: true,
      args: normalized,
      summary: describeWriteTool(name, normalized, snapshot),
    };
  }

  if (name === "virtual_bank_transfer") {
    const transferType = rawArgs.type === "credit" ? "credit" : "debit";
    const amount = Number(rawArgs.amount);
    const title =
      String(rawArgs.title || "").trim() ||
      (transferType === "credit" ? "เติมเงินเข้าบัญชี" : "โอนเงินออก");
    const counterparty = String(rawArgs.counterparty || "Finora Sandbox").trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: "จำนวนเงิน (amount) ต้องมากกว่า 0 บาท" };
    }
    if (transferType === "debit" && amount > bankBalance) {
      return {
        ok: false,
        error: `ยอดเงินใน Virtual Wallet คงเหลือ ฿${bankBalance.toLocaleString("en-US")} ไม่เพียงพอสำหรับการโอนออก ฿${amount.toLocaleString("en-US")}`,
      };
    }

    const normalized = { type: transferType, amount, title, counterparty };
    return {
      ok: true,
      args: normalized,
      summary: describeWriteTool(name, normalized, snapshot),
    };
  }

  if (name === "add_category") {
    const catName = String(rawArgs.name || "").trim();
    if (!catName) {
      return { ok: false, error: "ต้องระบุชื่อหมวดหมู่ (name)" };
    }
    if (categories.some((c) => c.name.trim().toLowerCase() === catName.toLowerCase())) {
      return { ok: false, error: `มีหมวดหมู่ "${catName}" อยู่ในระบบแล้ว ไม่สามารถสร้างซ้ำได้` };
    }
    const catType: TransactionType = rawArgs.type === "income" ? "income" : "expense";
    const rawBudget = Number(rawArgs.budget ?? 0);
    if (!Number.isFinite(rawBudget) || rawBudget < 0) {
      return { ok: false, error: "งบประมาณ (budget) ต้องเป็นตัวเลขตั้งแต่ 0 บาทขึ้นไป" };
    }
    const budget = catType === "income" ? 0 : rawBudget;
    const icon = pickCategoryIcon(catName, rawArgs.icon);
    const color =
      typeof rawArgs.color === "string" && rawArgs.color.startsWith("#")
        ? rawArgs.color
        : nextCategoryColor(categories.map((c) => c.color));

    const normalized = { name: catName, type: catType, budget, icon, color };
    return {
      ok: true,
      args: normalized,
      summary: describeWriteTool(name, normalized, snapshot),
    };
  }

  if (name === "add_recurring_payment") {
    const title = String(rawArgs.title || "").trim();
    if (!title) {
      return { ok: false, error: "ต้องระบุชื่อรายการตัดเงินอัตโนมัติ (title)" };
    }
    if (recurring.some((r) => r.title.trim().toLowerCase() === title.toLowerCase())) {
      return { ok: false, error: `มีรายการตัดเงินอัตโนมัติ "${title}" อยู่ในระบบแล้ว` };
    }
    const amount = Number(rawArgs.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: "จำนวนเงิน (amount) ต้องมากกว่า 0 บาท" };
    }
    const cycle =
      rawArgs.cycle === "weekly" || rawArgs.cycle === "yearly" ? rawArgs.cycle : "monthly";
    const rawDate = String(rawArgs.nextDueDate || "").trim();
    const nextDueDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? rawDate
      : defaultNextMonthFirstDay();

    const rawCat = String(rawArgs.categoryId || "").trim();
    const cat = rawCat
      ? resolveCategory(rawCat, categories, "expense")
      : resolveCategory("", categories, "expense", title) ||
        categories.find((c) => c.id === "entertainment") ||
        categories.find((c) => c.type === "expense") ||
        null;

    if (!cat) {
      const validList = categories
        .filter((c) => c.type === "expense")
        .map((c) => `${c.id} (${c.name})`)
        .join(", ");
      return {
        ok: false,
        error: `ไม่พบหมวดหมู่รายจ่าย "${rawCat}" สำหรับรายการตัดเงินอัตโนมัติ หมวดหมู่ที่มีคือ: ${validList}`,
      };
    }

    const normalized = {
      title,
      amount,
      categoryId: cat.id,
      cycle,
      nextDueDate,
      icon: "autorenew",
    };
    return {
      ok: true,
      args: normalized,
      summary: describeWriteTool(name, normalized, snapshot),
    };
  }

  return { ok: false, error: `ไม่รองรับคำสั่ง ${name}` };
}
