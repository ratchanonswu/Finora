export type OpenRouterContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: OpenRouterContent;
}

export async function callOpenRouter(options: {
  messages: OpenRouterMessage[];
  apiKeyOverride?: string;
  jsonMode?: boolean;
}): Promise<{ ok: boolean; text?: string; error?: string; status: number }> {
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
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      const msg = data?.error?.message || `OpenRouter API Error (${res.status})`;
      return { ok: false, status: res.status, error: msg };
    }

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return { ok: false, status: 502, error: "AI ไม่ได้ส่งข้อความตอบกลับ" };
    }

    return { ok: true, status: 200, text: content };
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : "ไม่สามารถเชื่อมต่อ OpenRouter API ได้",
    };
  }
}
