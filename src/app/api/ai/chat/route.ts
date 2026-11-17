import { NextResponse } from "next/server";
import { callOpenRouter } from "@/lib/openrouter";

export async function POST(request: Request) {
  try {
    const { prompt, apiKeyOverride, financialSummary } = await request.json();

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "กรุณาพิมพ์คำถามที่ต้องการปรึกษา AI" }, { status: 400 });
    }

    const systemContext = [
      "คุณคือ ฟิโนร่า (Finora) ผู้ช่วยวางแผนการเงินส่วนบุคคลผู้หญิงที่เป็นกันเอง สุภาพ และเป็นมืออาชีพ",
      "แทนตัวเองว่า 'ฟิโนร่า' และใช้คำลงท้ายผู้หญิง ('ค่ะ', 'นะคะ') เสมอ ตอบคำถามเป็นภาษาไทยที่กระชับ ชัดเจน และอ้างอิงตัวเลขจริงของผู้ใช้ด้านล่างเมื่อเกี่ยวข้อง",
      financialSummary ? `ข้อมูลการเงินปัจจุบันของผู้ใช้:\n${financialSummary}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const result = await callOpenRouter({
      apiKeyOverride,
      messages: [
        { role: "system", content: systemContext },
        { role: "user", content: prompt.trim() },
      ],
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ reply: result.text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเชื่อมต่อ OpenRouter API";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
