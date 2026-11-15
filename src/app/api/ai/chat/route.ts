import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(request: Request) {
  try {
    const { prompt, apiKeyOverride, financialSummary } = await request.json();

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "กรุณาพิมพ์คำถามที่ต้องการปรึกษา AI" }, { status: 400 });
    }

    const apiKey =
      (typeof apiKeyOverride === "string" && apiKeyOverride.trim()) ||
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "ยังไม่ได้ตั้งค่า GEMINI_API_KEY — กรุณาเพิ่มในไฟล์ .env.local หรือกรอกคีย์ของคุณในหน้า ตั้งค่าระบบ",
        },
        { status: 400 }
      );
    }

    const model = process.env.GEMINI_MODEL?.trim();
    if (!model) {
      return NextResponse.json(
        { error: "ยังไม่ได้ตั้งค่า GEMINI_MODEL ในไฟล์ .env.local" },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const systemContext = [
      "คุณคือ Finora AI Financial Advisor ผู้ช่วยวางแผนการเงินส่วนบุคคลมืออาชีพ",
      "ตอบคำถามเป็นภาษาไทยที่สุภาพ กระชับ ชัดเจน และอ้างอิงตัวเลขจริงของผู้ใช้ด้านล่างเมื่อเกี่ยวข้อง",
      financialSummary ? `ข้อมูลการเงินปัจจุบันของผู้ใช้:\n${financialSummary}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const response = await ai.models.generateContent({
      model,
      contents: `${systemContext}\n\nคำถามผู้ใช้: ${prompt.trim()}`,
    });

    return NextResponse.json({
      reply: response.text ?? "ขออภัย ไม่สามารถสร้างคำตอบได้ในขณะนี้",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเชื่อมต่อ Gemini API";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
