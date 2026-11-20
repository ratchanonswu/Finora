import type { OpenRouterToolDef } from "./openrouter.ts";
import { formatThaiDate, isInCurrentQuotaCycle, normalizeTransactionDate, todayYmd } from "./seed.ts";
import type { Category, RecurringPayment, Transaction, TransactionType } from "./types.ts";

export interface FinancialSnapshot {
  bankBalance: number;
  transactions: Transaction[];
  categories: Category[];
  recurring: RecurringPayment[];
  autoDebitOnExpense?: boolean;
  quotaResetAt?: string;
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
  "add_recurring_payment",
  "toggle_recurring",
]);

// Orders parallel tool calls by dependency: reads -> income -> config -> expense.
export function getToolExecutionPriority(name: string, args: Record<string, unknown>): number {
  if (READ_TOOL_NAMES.has(name)) return 0;
  if (name === "add_transaction" && args.type === "income") {
    return 1;
  }
  if (
    name === "update_category_budget" ||
    name === "add_recurring_payment" ||
    name === "toggle_recurring"
  ) {
    return 2;
  }
  return 3;
}

function defaultNextMonthFirstDay(): string {
  const now = new Date();
  const y = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const m = String(((now.getMonth() + 1) % 12) + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

const CATEGORY_ALIASES: Record<string, string> = {
  // Keep transport before housing so "รถไฟฟ้า" matches transport before "ไฟฟ้า" hits housing.
  transportation: "transport",
  travel: "transport",
  transit: "transport",
  commute: "transport",
  bts: "transport",
  mrt: "transport",
  grab: "transport",
  taxi: "transport",
  fuel: "transport",
  ptt: "transport",
  เดินทาง: "transport",
  น้ำมัน: "transport",
  รถไฟฟ้า: "transport",
  แท็กซี่: "transport",
  ทางด่วน: "transport",
  ปตท: "transport",
  dining: "food",
  drink: "food",
  drinks: "food",
  coffee: "food",
  cafe: "food",
  restaurant: "food",
  starbucks: "food",
  lunch: "food",
  dinner: "food",
  breakfast: "food",
  meal: "food",
  snack: "food",
  grocery: "food",
  groceries: "food",
  อาหาร: "food",
  เครื่องดื่ม: "food",
  กาแฟ: "food",
  ข้าว: "food",
  ก๋วยเตี๋ยว: "food",
  ขนม: "food",
  ชานม: "food",
  ชาเย็น: "food",
  ชาเขียว: "food",
  น้ำดื่ม: "food",
  shop: "shopping",
  lifestyle: "shopping",
  clothing: "shopping",
  fashion: "shopping",
  retail: "shopping",
  ช้อปปิ้ง: "shopping",
  เสื้อผ้า: "shopping",
  รองเท้า: "shopping",
  กระเป๋า: "shopping",
  ของใช้: "shopping",
  ซื้อของ: "shopping",
  house: "housing",
  home: "housing",
  rent: "housing",
  bill: "housing",
  bills: "housing",
  utility: "housing",
  utilities: "housing",
  internet: "housing",
  electricity: "housing",
  บิล: "housing",
  ที่อยู่อาศัย: "housing",
  ค่าเช่า: "housing",
  ค่าไฟ: "housing",
  ค่าน้ำ: "housing",
  ค่าเน็ต: "housing",
  อินเทอร์เน็ต: "housing",
  คอนโด: "housing",
  หอพัก: "housing",
  ไฟฟ้า: "housing",
  movie: "entertainment",
  subscription: "entertainment",
  subscriptions: "entertainment",
  game: "entertainment",
  netflix: "entertainment",
  spotify: "entertainment",
  youtube: "entertainment",
  cinema: "entertainment",
  concert: "entertainment",
  บันเทิง: "entertainment",
  ดูหนัง: "entertainment",
  คอนเสิร์ต: "entertainment",
  เกม: "entertainment",
  wage: "salary",
  bonus: "salary",
  income: "salary",
  freelance: "salary",
  payroll: "salary",
  เงินเดือน: "salary",
  โบนัส: "salary",
  ค่าจ้าง: "salary",
  ฟรีแลนซ์: "salary",
  รายได้: "salary",
  invest: "investment",
  dividend: "investment",
  stock: "investment",
  interest: "investment",
  fund: "investment",
  ปันผล: "investment",
  ลงทุน: "investment",
  หุ้น: "investment",
  กองทุน: "investment",
  ดอกเบี้ย: "investment",
  กำไร: "investment",
};

export function resolveCategory(
  raw: unknown,
  categories: Category[],
  expectedType?: TransactionType,
  fallbackText?: string
): Category | null {
  const nonRecurring = categories.filter((c) => c.id !== "recurring");
  const pool = expectedType ? nonRecurring.filter((c) => c.type === expectedType) : nonRecurring;
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
      description: "ดูยอดเงิน Virtual Wallet คงเหลือ, รายรับรวม, รายจ่ายรวม, และยอดสุทธิปัจจุบัน",
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
      description:
        "ดูรายการประจำ (Recurring) ทั้งรายจ่ายประจำและรายรับประจำ สถานะ และวันครบกำหนดถัดไป",
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
      description:
        "เรียกใช้ทันทีเมื่อผู้ใช้แจ้งรายรับหรือรายจ่ายที่มีชื่อรายการและจำนวนเงิน เพื่อเปิดหน้าต่างยืนยันบน UI (ห้ามพิมพ์ถามยืนยันในแชทก่อนเรียกเครื่องมือนี้)",
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
            description:
              "ช่องทาง เช่น Virtual Bank Wallet, สแกน PromptPay QR, Virtual Card, เงินสด (ถ้าผู้ใช้ไม่ระบุ ให้ใช้ค่าเริ่มต้น 'Virtual Bank Wallet' ทันทีโดยไม่ต้องถามซ้ำ)",
          },
          date: {
            type: "string",
            description:
              "วันที่ของรายการรูปแบบ YYYY-MM-DD (ค.ศ.) หรือ DD/MM หากผู้ใช้ระบุวันที่ เช่น '15/08' หรือ 'เมื่อวาน' (ถ้าไม่ระบุไม่ต้องส่ง ระบบจะใช้วันที่ปัจจุบัน)",
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
      description:
        "เรียกใช้ทันทีเมื่อผู้ใช้ต้องการปรับงบประมาณรายเดือนของหมวดหมู่รายจ่าย เพื่อแสดงการ์ดยืนยันบน UI (ห้ามถามยืนยันในแชทก่อนเรียกเครื่องมือนี้)",
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
      description:
        "เรียกใช้ทันทีเมื่อผู้ใช้ต้องการเปิดใช้งานหรือพักรายการประจำ เพื่อแสดงการ์ดยืนยันบน UI (ห้ามถามยืนยันในแชทก่อนเรียกเครื่องมือนี้)",
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
      name: "add_recurring_payment",
      description:
        "เรียกใช้ทันทีเมื่อผู้ใช้ต้องการสร้างรายการประจำ (Recurring) ใหม่ ทั้งรายจ่ายประจำ (expense) และรายรับประจำ (income) เพื่อแสดงการ์ดยืนยันบน UI (ห้ามถามยืนยันในแชทก่อนเรียกเครื่องมือนี้)",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["expense", "income"],
            description:
              "ประเภทรายการประจำ: expense (รายจ่ายประจำ เช่น บิล/สมาชิก) หรือ income (รายรับประจำ เช่น เงินเดือนประจำ)",
          },
          title: {
            type: "string",
            description: "ชื่อรายการ เช่น YouTube Premium, ค่าอินเทอร์เน็ต, เงินเดือนประจำ",
          },
          amount: { type: "number", description: "จำนวนเงินต่อรอบ (บาท, มากกว่า 0)" },
          categoryId: {
            type: "string",
            description:
              "รหัสหมวดหมู่รายรับเมื่อ type เป็น income (เช่น salary, investment); สำหรับรายจ่ายประจำระบบใช้หมวด recurring อัตโนมัติ",
          },
          cycle: {
            type: "string",
            enum: ["monthly", "weekly", "yearly"],
            description: "รอบรายการประจำ (ค่าเริ่มต้น monthly)",
          },
          nextDueDate: {
            type: "string",
            description:
              "วันครบกำหนดถัดไปในรูปแบบ YYYY-MM-DD (ถ้าไม่ระบุจะใช้วันที่ 1 ของเดือนถัดไป)",
          },
        },
        required: ["title", "amount"],
      },
    },
  },
];

function sumActiveRecurringMonthly(
  recurring: RecurringPayment[],
  targetType: TransactionType
): number {
  return recurring
    .filter((r) => r.active && (r.type ?? "expense") === targetType)
    .reduce((s, r) => s + (r.cycle === "yearly" ? r.amount / 12 : r.amount), 0);
}

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
      categories: categories
        .filter((c) => c.id !== "recurring")
        .map((c) => {
          const spent = transactions
            .filter(
              (t) =>
                t.categoryId === c.id &&
                isInCurrentQuotaCycle(t.date, snapshot.quotaResetAt)
            )
            .reduce((s, t) => s + t.amount, 0);
          return { id: c.id, name: c.name, type: c.type, budget: c.budget, spent };
        }),
    };
  }

  if (name === "get_recurring_payments") {
    const activeMonthlyTotal = sumActiveRecurringMonthly(recurring, "expense");
    const activeMonthlyIncomeTotal = sumActiveRecurringMonthly(recurring, "income");
    return {
      activeMonthlyTotal,
      activeMonthlyIncomeTotal,
      items: recurring.map((r) => ({
        id: r.id,
        title: r.title,
        amount: r.amount,
        type: r.type ?? "expense",
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
    const activeRecurringMonthly = sumActiveRecurringMonthly(recurring, "expense");
    const activeRecurringIncomeMonthly = sumActiveRecurringMonthly(recurring, "income");

    // Avoid double-counting recurring items if they already appear in transactions; use whichever is higher as baseline.
    const estimatedMonthlyInflow = Math.max(income, activeRecurringIncomeMonthly);
    const estimatedMonthlyOutflow = Math.max(expense, activeRecurringMonthly);
    const estimatedMonthlyNet = estimatedMonthlyInflow - estimatedMonthlyOutflow;
    const projectedBalance = bankBalance + estimatedMonthlyNet * months;

    return {
      monthsAhead: months,
      currentBankBalance: bankBalance,
      baselineMonthlyIncome: estimatedMonthlyInflow,
      baselineMonthlyOutflow: estimatedMonthlyOutflow,
      activeRecurringMonthly,
      activeRecurringIncomeMonthly,
      estimatedMonthlyNet,
      projectedBalance,
      lowBalanceRisk: projectedBalance < activeRecurringMonthly,
      assumptions: [
        "คำนวณจากยอดรายรับและรายจ่ายที่บันทึกไว้ในระบบปัจจุบันเป็นฐานรายเดือน",
        `รวมรายรับประจำ (Recurring Income) ที่เปิดใช้งานอยู่เดือนละ ${activeRecurringIncomeMonthly.toLocaleString("en-US")} บาท และภาระรายจ่ายประจำ (Recurring Expense) ที่เปิดใช้งานอยู่เดือนละ ${activeRecurringMonthly.toLocaleString("en-US")} บาท`,
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
    const ch = String(args.channel || "").trim();
    const chSuffix = ch && ch !== "Virtual Bank Wallet" ? `, ช่องทาง: ${ch}` : "";
    const dateStr = String(args.date || "").trim();
    const dateSuffix = dateStr ? `, วันที่: ${formatThaiDate(dateStr)}` : "";
    return `บันทึก${typeLabel} "${String(args.title || "")}" จำนวน ฿${Number(args.amount || 0).toLocaleString("en-US")} (หมวดหมู่: ${cat}${chSuffix}${dateSuffix})`;
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
  if (name === "add_recurring_payment") {
    const isIncome = args.type === "income";
    const typeLabel = isIncome ? "รายรับประจำ" : "รายการตัดเงินอัตโนมัติ";
    const cycleLabel =
      args.cycle === "weekly" ? "รายสัปดาห์" : args.cycle === "yearly" ? "รายปี" : "รายเดือน";
    const cat =
      snapshot.categories.find((c) => c.id === args.categoryId)?.name ||
      String(args.categoryId || "");
    return `เพิ่ม${typeLabel} "${String(args.title || "")}" ฿${Number(args.amount || 0).toLocaleString("en-US")} (${cycleLabel}, หมวด: ${cat}, ครบกำหนด: ${String(args.nextDueDate || "")})`;
  }
  return `ดำเนินการ ${name}`;
}

export function validateAndNormalizeWriteTool(
  name: string,
  rawArgs: Record<string, unknown>,
  snapshot: FinancialSnapshot
): { ok: true; args: Record<string, unknown>; summary: string } | { ok: false; error: string } {
  const { categories, recurring } = snapshot;

  if (name === "add_transaction") {
    const txType: TransactionType = rawArgs.type === "income" ? "income" : "expense";
    const title = String(rawArgs.title || "").trim();
    const amount = Number(rawArgs.amount);

    const rawChannel = String(rawArgs.channel || "Virtual Bank Wallet").trim();
    const lowerChannel = rawChannel.toLowerCase();
    const channel =
      lowerChannel === "เงินสด" || lowerChannel === "cash"
        ? "เงินสด"
        : /promptpay|พร้อมเพย์|qr/.test(lowerChannel)
        ? "สแกน PromptPay QR"
        : /card|บัตร/.test(lowerChannel)
        ? "Virtual Card"
        : /bank|wallet|บัญชี|ธนาคาร|โอน/.test(lowerChannel)
        ? "Virtual Bank Wallet"
        : rawChannel;

    if (!title) {
      return { ok: false, error: "ต้องระบุชื่อรายการ (title)" };
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: "จำนวนเงิน (amount) ต้องเป็นตัวเลขที่มากกว่า 0 บาท" };
    }

    const rawDate = rawArgs.date === undefined || rawArgs.date === null ? "" : String(rawArgs.date).trim();
    const normalizedDate = rawDate ? normalizeTransactionDate(rawDate) : todayYmd();
    if (!normalizedDate) {
      return {
        ok: false,
        error: `รูปแบบวันที่ "${rawDate}" ไม่ถูกต้อง กรุณาระบุเป็น YYYY-MM-DD หรือ DD/MM (เช่น 2026-08-15 หรือ 15/08)`,
      };
    }

    const rawCat = String(rawArgs.categoryId || "").trim();
    const cat = resolveCategory(rawCat, categories, txType, title);

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
      channel,
      date: normalizedDate,
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
        .filter((c) => c.type === "expense" && c.id !== "recurring")
        .map((c) => `${c.id} (${c.name})`)
        .join(", ");
      return {
        ok: false,
        error: `ไม่พบหมวดหมู่รายจ่าย "${String(rawArgs.categoryId || "")}" หมวดหมู่รายจ่ายที่ตั้งงบได้คือ: ${validExpenseCats}`,
      };
    }
    if (cat.id === "recurring") {
      return {
        ok: false,
        error:
          "งบประมาณหมวดรายจ่ายประจำ (Recurring) คำนวณอัตโนมัติจากรายการที่เปิดใช้งาน ไม่สามารถแก้ไขโดยตรงได้",
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

    const recType: TransactionType = rawArgs.type === "income" ? "income" : "expense";
    let categoryId = "recurring";
    if (recType === "income") {
      const cat = resolveCategory(rawArgs.categoryId, categories, "income", title);
      categoryId = cat?.id || "salary";
    }

    const normalized = {
      title,
      amount,
      type: recType,
      categoryId,
      cycle,
      nextDueDate,
      icon: recType === "income" ? "payments" : "autorenew",
    };
    return {
      ok: true,
      args: normalized,
      summary: describeWriteTool(name, normalized, snapshot),
    };
  }

  return { ok: false, error: `ไม่รองรับคำสั่ง ${name}` };
}
