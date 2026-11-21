const OCR_SPACE_ENDPOINT = "https://api.ocr.space/parse/image";
const OCR_SPACE_MAX_BASE64_LEN = 1_350_000; // ~1 MB decoded limit on OCR.space free tier
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function cleanOcrText(raw: string): string {
  return String(raw || "")
    .replace(/^\s*\[Note:[^\]]*\]\s*$/gim, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 2500);
}

// Best-effort Thai/English slip text extraction via OCR.space; returns undefined on any limit or network failure.
export async function extractSlipOcrText(
  imageBase64: string,
  mimeType?: string
): Promise<string | undefined> {
  if (!imageBase64 || imageBase64.length > OCR_SPACE_MAX_BASE64_LEN) {
    if (imageBase64.length > OCR_SPACE_MAX_BASE64_LEN) {
      console.warn("[OCR] skipped", { reason: "payload_exceeds_1mb_limit", len: imageBase64.length });
    }
    return undefined;
  }

  const safeMime = mimeType && ALLOWED_MIME_TYPES.has(mimeType) ? mimeType : "image/jpeg";
  const apiKey = process.env.OCR_SPACE_API_KEY?.trim() || "helloworld";
  const startMs = Date.now();

  try {
    const form = new FormData();
    form.append("base64Image", `data:${safeMime};base64,${imageBase64}`);
    form.append("language", "tha");
    form.append("OCREngine", "1");

    const res = await fetch(OCR_SPACE_ENDPOINT, {
      method: "POST",
      headers: { apikey: apiKey },
      body: form,
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.warn("[OCR] skipped", { status: res.status, latencyMs: Date.now() - startMs });
      return undefined;
    }

    const data = (await res.json()) as {
      IsErroredOnProcessing?: boolean;
      ErrorMessage?: unknown;
      ParsedResults?: Array<{ ParsedText?: string }>;
    };

    if (data?.IsErroredOnProcessing) {
      console.warn("[OCR] skipped", {
        reason: "processing_error",
        error: data.ErrorMessage,
        latencyMs: Date.now() - startMs,
      });
      return undefined;
    }

    const rawText = (Array.isArray(data?.ParsedResults) ? data.ParsedResults : [])
      .map((r) => String(r?.ParsedText || "").trim())
      .filter(Boolean)
      .join("\n");
    const text = cleanOcrText(rawText);

    if (!text) {
      console.info("[OCR]", { ok: true, chars: 0, latencyMs: Date.now() - startMs });
      return undefined;
    }

    console.info("[OCR]", { ok: true, chars: text.length, latencyMs: Date.now() - startMs });
    return text;
  } catch (err) {
    console.warn("[OCR] skipped", {
      reason: err instanceof Error ? err.message : "unknown_error",
      latencyMs: Date.now() - startMs,
    });
    return undefined;
  }
}
