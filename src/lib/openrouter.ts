export type OpenRouterContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
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

export async function callOpenRouter(options: {
  messages: OpenRouterMessage[];
  apiKeyOverride?: string;
  jsonMode?: boolean;
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

  try {
    const startMs = Date.now();
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Finora AI Wealth Engine",
      },
      body: JSON.stringify({
        model,
        messages: options.messages,
        ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
        ...(options.tools?.length ? { tools: options.tools, tool_choice: "auto" } : {}),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      const msg = data?.error?.message || `OpenRouter API Error (${res.status})`;
      return { ok: false, status: res.status, error: msg };
    }

    const message = data?.choices?.[0]?.message;
    const toolCalls: OpenRouterToolCall[] | undefined =
      Array.isArray(message?.tool_calls) && message.tool_calls.length > 0
        ? message.tool_calls
        : undefined;
    const content = typeof message?.content === "string" ? message.content : undefined;

    if (!toolCalls && (!content || !content.trim())) {
      return { ok: false, status: 502, error: "AI ไม่ได้ส่งข้อความตอบกลับ" };
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
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : "ไม่สามารถเชื่อมต่อ OpenRouter API ได้",
    };
  }
}
