import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(request: Request) {
  try {
    const { imageBase64, mimeType, qrRaw, categories, apiKeyOverride } = await request.json();

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json({ error: "ไม่พบข้อมูลรูปภาพ" }, { status: 400 });
    }

    const apiKey =
      (typeof apiKeyOverride === "string" && apiKeyOverride.trim()) ||
      process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL?.trim();

    if (!apiKey || !model) {
      return NextResponse.json(
        { error: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY หรือ GEMINI_MODEL" },
        { status: 400 }
      );
    }

    const categoryList = Array.isArray(categories)
      ? categories.map((c: { id: string; name: string }) => `${c.id}: ${c.name}`).join(", ")
      : "food, shopping, housing, transport, entertainment";

    const prompt = [
      "วิเคราะห์รูปภาพนี้ว่าเป็นป้าย QR Code รับเงิน (เช่น PromptPay / Thai QR Payment) หรือสลิปโอนเงินธนาคารหรือไม่",
      qrRaw ? `ข้อมูลดิบที่อ่านได้จากบาร์โค้ด QR: ${qrRaw}` : "ไม่พบบาร์โค้ดจากตัวอ่านเบื้องต้น ให้ตรวจสอบจากภาพโดยตรง",
      `หมวดหมู่ที่เลือกได้: ${categoryList}`,
      "ตอบกลับเป็น JSON เท่านั้นตามโครงสร้างนี้:",
      '{ "isValidPaymentImage": boolean, "merchant": string, "promptPayId": string, "amount": number, "categoryId": string }',
      "กฎสำคัญ:",
      "1. ถ้ารูปนี้ไม่ใช่ QR Code และไม่ใช่สลิปโอนเงินหรือป้ายรับเงิน ให้ตั้ง isValidPaymentImage = false",
      "2. merchant: ชื่อร้านค้า ชื่อบัญชีผู้รับเงิน หรือชื่อบริษัทที่ปรากฏในภาพ/สลิป (ถ้าไม่มีชื่อให้อ่านได้ ให้ส่งค่าว่าง \"\")",
      "3. promptPayId: เลขพร้อมเพย์ เบอร์โทร เลขประจำตัวผู้เสียภาษี หรือรหัสร้านค้าที่ปรากฏในภาพ (ถ้าไม่มีให้ส่ง \"\")",
      "4. amount: ยอดเงินที่ระบุในสลิปหรือป้าย QR เท่านั้น ถ้าในภาพไม่ได้ระบุยอดเงินไว้ ให้ส่ง 0 เสมอ ห้ามเดาหรือสุ่มตัวเลขเด็ดขาด",
      "5. categoryId: เลือก id หมวดหมู่ที่ตรงกับร้านค้าที่สุด (ถ้าไม่แน่ใจใช้ \"food\")",
    ].join("\n");

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: imageBase64, mimeType: mimeType || "image/jpeg" } },
            { text: prompt },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    return NextResponse.json({
      isValidPaymentImage: Boolean(parsed.isValidPaymentImage),
      merchant: typeof parsed.merchant === "string" ? parsed.merchant.trim() : "",
      promptPayId: typeof parsed.promptPayId === "string" ? parsed.promptPayId.trim() : "",
      amount: typeof parsed.amount === "number" && parsed.amount > 0 ? parsed.amount : 0,
      categoryId: typeof parsed.categoryId === "string" ? parsed.categoryId : "food",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ไม่สามารถวิเคราะห์รูปภาพด้วย AI ได้";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
