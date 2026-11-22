import { NextResponse } from "next/server";
import { callOpenRouter, type OpenRouterMessage } from "@/lib/openrouter";
import { FINORA_TOOLS } from "@/lib/ai-tools";
import { buildFinoraSystemPrompt, classifyUserPromptMode } from "@/lib/prompts";

function getLatestUserText(conversation: OpenRouterMessage[]): string {
  for (let i = conversation.length - 1; i >= 0; i--) {
    const msg = conversation[i];
    if (msg.role === "user" && typeof msg.content === "string") {
      const text = msg.content.trim();
      if (text && !text.startsWith("[ระบบ]")) {
        return text;
      }
    }
  }
  return "";
}

export async function POST(request: Request) {
  try {
    const { prompt, messages, apiKeyOverride, financialSummary } = await request.json();

    const conversation: OpenRouterMessage[] = Array.isArray(messages) && messages.length > 0
      ? messages
      : typeof prompt === "string" && prompt.trim()
      ? [{ role: "user", content: prompt.trim() }]
      : [];

    if (conversation.length === 0) {
      return NextResponse.json({ error: "กรุณาพิมพ์คำถามที่ต้องการปรึกษา AI" }, { status: 400 });
    }

    const responseMode = classifyUserPromptMode(getLatestUserText(conversation));

    const result = await callOpenRouter({
      apiKeyOverride,
      tools: FINORA_TOOLS,
      messages: [
        {
          role: "system",
          content: buildFinoraSystemPrompt(financialSummary, { responseMode }),
        },
        ...conversation,
      ],
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      reply: result.text || "",
      toolCalls: result.toolCalls,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเชื่อมต่อ OpenRouter API";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
