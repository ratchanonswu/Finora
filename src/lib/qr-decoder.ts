import jsQR from "jsqr";

const DIRECT_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;
const DIRECT_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

// Multi-pass canvas QR decoder (full image, high-contrast pass, and center-crop pass) + high-res Vision export.
export async function decodeQrImage(file: File): Promise<{
  qrRaw: string | null;
  imageBase64: string;
  mimeType: string;
  thumbnailDataUrl: string;
}> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์รูปภาพได้"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("รูปภาพไม่ถูกต้อง"));
    el.src = dataUrl;
  });

  const directBase64 = dataUrl.split(",")[1] || "";
  const canSendDirect =
    file.size <= DIRECT_UPLOAD_MAX_BYTES && DIRECT_MIME_TYPES.has(file.type) && directBase64.length > 0;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return {
      qrRaw: null,
      imageBase64: directBase64,
      mimeType: file.type || "image/jpeg",
      thumbnailDataUrl: dataUrl,
    };
  }

  const drawWithWhiteBg = (
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    w: number,
    h: number
  ) => {
    canvas.width = w;
    canvas.height = h;
    // White backdrop prevents transparent PNG QR codes from turning solid black
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  };

  const runPass = (
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    maxDim: number,
    highContrast: boolean
  ): string | null => {
    const scale = Math.min(1, maxDim / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));
    drawWithWhiteBg(sx, sy, sw, sh, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    if (highContrast) {
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const v = lum < 140 ? 0 : 255;
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v;
      }
    }
    const code = jsQR(imageData.data, w, h, { inversionAttempts: "attemptBoth" });
    return code?.data?.trim() || null;
  };

  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;

  // Send original file when <= 2MB; otherwise downscale to 2048px at high JPEG quality so Thai text stays sharp
  let imageBase64 = directBase64;
  let mimeType = file.type || "image/jpeg";
  if (!canSendDirect) {
    const vScale = Math.min(1, 2048 / Math.max(iw, ih));
    drawWithWhiteBg(0, 0, iw, ih, Math.max(1, Math.round(iw * vScale)), Math.max(1, Math.round(ih * vScale)));
    imageBase64 = canvas.toDataURL("image/jpeg", 0.95).split(",")[1] || "";
    mimeType = "image/jpeg";
  }

  let nativeQr: string | null = null;
  try {
    type NativeBarcodeDetector = {
      detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
    };
    const BarcodeDetectorCtor = (
      globalThis as unknown as {
        BarcodeDetector?: new (opts?: { formats: string[] }) => NativeBarcodeDetector;
      }
    ).BarcodeDetector;
    if (BarcodeDetectorCtor) {
      const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
      const hits = await detector.detect(img);
      nativeQr = hits.find((h) => h.rawValue?.trim())?.rawValue?.trim() || null;
    }
  } catch {
    // Fall back to jsQR multi-pass decoding if native BarcodeDetector fails
  }

  const qrRaw =
    nativeQr ||
    runPass(0, 0, iw, ih, 1200, false) ||
    runPass(0, 0, iw, ih, 1800, true) ||
    // Bottom-right quadrant (K+, SCB, KTB, BBL slip verification Mini-QR)
    runPass(iw * 0.45, ih * 0.55, iw * 0.55, ih * 0.45, 1200, false) ||
    runPass(iw * 0.45, ih * 0.55, iw * 0.55, ih * 0.45, 1200, true) ||
    // Bottom half (slips with bottom-left or bottom-center QR)
    runPass(0, ih * 0.5, iw, ih * 0.5, 1400, false) ||
    runPass(0, ih * 0.5, iw, ih * 0.5, 1400, true) ||
    // Center crop (standee / merchant QR signs)
    runPass(iw * 0.15, ih * 0.15, iw * 0.7, ih * 0.7, 1400, false) ||
    runPass(iw * 0.15, ih * 0.15, iw * 0.7, ih * 0.7, 1400, true);

  // Create compact 180px thumbnail so sessionStorage stays well within quota
  const thumbScale = Math.min(1, 180 / Math.max(iw, ih));
  drawWithWhiteBg(0, 0, iw, ih, Math.max(1, Math.round(iw * thumbScale)), Math.max(1, Math.round(ih * thumbScale)));
  const thumbnailDataUrl = canvas.toDataURL("image/jpeg", 0.8);

  return { qrRaw, imageBase64, mimeType, thumbnailDataUrl };
}
