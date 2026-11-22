export type OpenRouterContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } }
    >;

export interface OpenRouterToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: OpenRouterContent | null;
  tool_calls?: OpenRouterToolCall[];
  tool_call_id?: string;
}

export interface OpenRouterToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LLMMetrics {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
}

const OPENROUTER_TIMEOUT_MS = 65_000;
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const RETRY_DELAYS_MS = [1000, 2000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callOpenRouter(options: {
  messages: OpenRouterMessage[];
  apiKeyOverride?: string;
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
  tools?: OpenRouterToolDef[];
}): Promise<{
  ok: boolean;
  text?: string;
  toolCalls?: OpenRouterToolCall[];
  metrics?: LLMMetrics;
  error?: string;
  status: number;
}> {
  const apiKey =
    (typeof options.apiKeyOverride === "string" && options.apiKeyOverride.trim()) ||
    process.env.OPENROUTER_API_KEY?.trim();

  if (!apiKey) {
    return {
      ok: false,
      status: 400,
      error:
        "ยังไม่ได้ตั้งค่า OPENROUTER_API_KEY — กรุณาเพิ่มในไฟล์ .env.local หรือกรอกคีย์ของคุณในหน้า ตั้งค่าระบบ",
    };
  }

  const model = process.env.OPENROUTER_MODEL?.trim();
  if (!model) {
    return {
      ok: false,
      status: 400,
      error: "ยังไม่ได้ตั้งค่า OPENROUTER_MODEL ในไฟล์ .env.local",
    };
  }

  const requestBody = JSON.stringify({
    model,
    messages: options.messages,
    ...(typeof options.temperature === "number" ? { temperature: options.temperature } : {}),
    ...(typeof options.maxTokens === "number" && options.maxTokens > 0
      ? { max_tokens: Math.round(options.maxTokens) }
      : {}),
    ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
    ...(options.tools?.length ? { tools: options.tools, tool_choice: "auto" } : {}),
  });

  const startMs = Date.now();
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "Finora AI Wealth Engine",
        },
        body: requestBody,
        signal: AbortSignal.timeout(OPENROUTER_TIMEOUT_MS),
      });

      const rawText = await res.text();
      let data: {
        error?: { message?: string };
        choices?: Array<{
          finish_reason?: unknown;
          message?: { content?: unknown; tool_calls?: unknown };
        }>;
        model?: unknown;
        usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown };
      } | null = null;
      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = null;
        }
      }

      if (!res.ok) {
        if (RETRYABLE_STATUSES.has(res.status) && attempt < RETRY_DELAYS_MS.length) {
          console.warn("[LLM] retryable status", { status: res.status, attempt: attempt + 1 });
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        const msg = data?.error?.message || `OpenRouter API Error (${res.status})`;
        return { ok: false, status: res.status, error: msg };
      }

      if (!data) {
        return { ok: false, status: 502, error: "OpenRouter ส่งข้อมูลที่ไม่ใช่รูปแบบ JSON" };
      }

      const choice = data?.choices?.[0];
      const message = choice?.message;
      const finishReason =
        typeof choice?.finish_reason === "string" ? choice.finish_reason : undefined;
      const toolCalls: OpenRouterToolCall[] | undefined =
        Array.isArray(message?.tool_calls) && message.tool_calls.length > 0
          ? (message.tool_calls as OpenRouterToolCall[])
          : undefined;
      const content = typeof message?.content === "string" ? message.content : undefined;

      if (!toolCalls && (!content || !content.trim())) {
        console.warn("[LLM] empty reply", {
          model: String(data?.model || model),
          finishReason,
          usage: data?.usage,
        });
        return {
          ok: false,
          status: 502,
          error:
            finishReason === "length"
              ? "AI ประมวลผลเกินขีดจำกัดความยาวก่อนส่งคำตอบ กรุณาลองใหม่อีกครั้ง"
              : "AI ไม่ได้ส่งข้อความตอบกลับ",
        };
      }

      const metrics: LLMMetrics = {
        model: String(data?.model || model),
        inputTokens: Number(data?.usage?.prompt_tokens || 0),
        outputTokens: Number(data?.usage?.completion_tokens || 0),
        totalTokens: Number(data?.usage?.total_tokens || 0),
        latencyMs: Date.now() - startMs,
      };
      console.info("[LLM]", metrics);

      return { ok: true, status: 200, text: content || "", toolCalls, metrics };
    } catch (err) {
      if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
        return {
          ok: false,
          status: 504,
          error: "การเชื่อมต่อ AI ใช้เวลานานเกินกำหนด (65 วินาที) กรุณาลองใหม่อีกครั้ง",
        };
      }
      if (attempt < RETRY_DELAYS_MS.length) {
        console.warn("[LLM] transient network error, retrying", { attempt: attempt + 1 });
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      return {
        ok: false,
        status: 500,
        error: err instanceof Error ? err.message : "ไม่สามารถเชื่อมต่อ OpenRouter API ได้",
      };
    }
  }

  return { ok: false, status: 503, error: "บริการ AI ไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่อีกครั้ง" };
}
