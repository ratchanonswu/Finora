import { NextResponse } from "next/server";
import { extractSlipOcrText } from "@/lib/ocr";
import { callOpenRouter } from "@/lib/openrouter";
import { buildSlipPrompt, parseSlipResult } from "@/lib/prompts";

export async function POST(request: Request) {
  try {
    const { imageBase64, mimeType, categories, userName, apiKeyOverride } =
      await request.json();

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json({ error: "ไม่พบข้อมูลรูปภาพ" }, { status: 400 });
    }

    const filteredCats = Array.isArray(categories)
      ? (categories as { id: string; name: string; type?: string }[]).filter(
          (c) => c.id !== "recurring"
        )
      : [];

    const categoryList =
      filteredCats.length > 0
        ? filteredCats
            .map((c) => `${c.id} (${c.type || "expense"}: ${c.name})`)
            .join(", ")
        : "food, shopping, housing, transport, entertainment, salary, investment";

    const ocrText = await extractSlipOcrText(imageBase64, mimeType);
    const prompt = buildSlipPrompt(categoryList, userName, ocrText);

    const result = await callOpenRouter({
      apiKeyOverride,
      jsonMode: true,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
    });

    if (!result.ok || !result.text) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const validated = parseSlipResult(
      result.text,
      filteredCats.map((c) => c.id),
      userName
    );
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 502 });
    }

    return NextResponse.json(validated.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "ไม่สามารถวิเคราะห์รูปภาพด้วย AI ได้";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
