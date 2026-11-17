import { NextResponse } from "next/server";
import { callOpenRouter } from "@/lib/openrouter";

export async function POST(request: Request) {
  try {
    const { imageBase64, mimeType, qrRaw, categories, apiKeyOverride } = await request.json();

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json({ error: "ไม่พบข้อมูลรูปภาพ" }, { status: 400 });
    }

    const categoryList = Array.isArray(categories)
      ? categories
          .map((c: { id: string; name: string; type?: string }) => `${c.id} (${c.type || "expense"}: ${c.name})`)
          .join(", ")
      : "food, shopping, housing, transport, entertainment, salary, investment";

    const prompt = [
      "วิเคราะห์รูปภาพนี้ว่าเป็นป้าย QR Code รับเงิน (PromptPay / Thai QR Payment) หรือสลิปธุรกรรมธนาคารหรือไม่",
      qrRaw ? `ข้อมูลดิบที่อ่านได้จากบาร์โค้ด QR: ${qrRaw}` : "ไม่พบบาร์โค้ดจากตัวอ่านเบื้องต้น ให้ตรวจสอบจากภาพโดยตรง",
      `หมวดหมู่ที่เลือกได้: ${categoryList}`,
      "ตอบกลับเป็น JSON เท่านั้นตามโครงสร้างนี้:",
      '{ "isValidPaymentImage": boolean, "type": "expense" | "income", "merchant": string, "promptPayId": string, "amount": number, "categoryId": string }',
      "กฎสำคัญ:",
      "1. ถ้ารูปนี้ไม่ใช่ QR Code และไม่ใช่สลิปโอนเงินหรือป้ายรับเงิน ให้ตั้ง isValidPaymentImage = false",
      "2. type: ใช้ \"income\" หากเป็นสลิปเงินเข้า/เงินเดือน/ปันผล/รับโอนเงิน และใช้ \"expense\" หากเป็นป้าย QR ร้านค้าหรือสลิปจ่ายเงิน/โอนออก (ค่าเริ่มต้นคือ \"expense\")",
      "3. merchant: ชื่อร้านค้า ชื่อผู้รับเงิน หรือชื่อผู้โอนที่ปรากฏในภาพ/สลิป (ถ้าไม่มีชื่อให้อ่านได้ ให้ส่งค่าว่าง \"\")",
      "4. promptPayId: เลขพร้อมเพย์ เบอร์โทร เลขประจำตัวผู้เสียภาษี หรือรหัสอ้างอิงที่ปรากฏในภาพ (ถ้าไม่มีให้ส่ง \"\")",
      "5. amount: ยอดเงินที่ระบุในสลิปหรือป้าย QR เท่านั้น ถ้าในภาพไม่ได้ระบุยอดเงินไว้ ให้ส่ง 0 เสมอ ห้ามเดาหรือสุ่มตัวเลขเด็ดขาด",
      "6. categoryId: เลือก id หมวดหมู่ที่ตรงกับ type และรายการนั้นที่สุด (ถ้าเป็นรายรับใช้ \"salary\" หรือ \"investment\", ถ้าเป็นรายจ่ายและไม่แน่ใจใช้ \"food\")",
    ].join("\n");

    const result = await callOpenRouter({
      apiKeyOverride,
      jsonMode: true,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}` },
            },
          ],
        },
      ],
    });

    if (!result.ok || !result.text) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    // Strip optional markdown code fences before parsing JSON
    const cleaned = result.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned || "{}");

    return NextResponse.json({
      isValidPaymentImage: Boolean(parsed.isValidPaymentImage),
      type: parsed.type === "income" ? "income" : "expense",
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
