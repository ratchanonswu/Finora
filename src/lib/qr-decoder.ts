import jsQR from "jsqr";

// Multi-pass canvas QR decoder (full image, high-contrast pass, and center-crop pass) + JPEG base64 & thumbnail export.
export async function decodeQrImage(file: File): Promise<{
  qrRaw: string | null;
  imageBase64: string;
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

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return {
      qrRaw: null,
      imageBase64: dataUrl.split(",")[1] || "",
      thumbnailDataUrl: dataUrl,
    };
  }

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
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
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

  // Pass 1 also prepares the 1024px JPEG base64 for Gemini Vision
  const pass1 = runPass(0, 0, iw, ih, 1024, false);
  const imageBase64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1] || "";

  const qrRaw =
    pass1 ||
    runPass(0, 0, iw, ih, 1600, true) ||
    runPass(iw * 0.15, ih * 0.15, iw * 0.7, ih * 0.7, 1200, false) ||
    runPass(iw * 0.15, ih * 0.15, iw * 0.7, ih * 0.7, 1200, true);

  // Create compact 180px thumbnail so sessionStorage stays well within quota
  const thumbScale = Math.min(1, 180 / Math.max(iw, ih));
  canvas.width = Math.max(1, Math.round(iw * thumbScale));
  canvas.height = Math.max(1, Math.round(ih * thumbScale));
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const thumbnailDataUrl = canvas.toDataURL("image/jpeg", 0.75);

  return { qrRaw, imageBase64, thumbnailDataUrl };
}
