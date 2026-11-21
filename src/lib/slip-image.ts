const DIRECT_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;
const DIRECT_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

// Prepare slip image for OCR/Vision upload (direct if <= 2MB, else downscaled to 2048px) plus a compact 180px thumbnail.
export async function prepareSlipImage(file: File): Promise<{
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
    file.size <= DIRECT_UPLOAD_MAX_BYTES &&
    DIRECT_MIME_TYPES.has(file.type) &&
    directBase64.length > 0;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      imageBase64: directBase64,
      mimeType: file.type || "image/jpeg",
      thumbnailDataUrl: dataUrl,
    };
  }

  const drawWithWhiteBg = (w: number, h: number) => {
    canvas.width = w;
    canvas.height = h;
    // White backdrop keeps transparent PNG slips readable
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
  };

  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;

  // Send original file when <= 2MB; otherwise downscale to 2048px at high JPEG quality so Thai text stays sharp
  let imageBase64 = directBase64;
  let mimeType = file.type || "image/jpeg";
  if (!canSendDirect) {
    const vScale = Math.min(1, 2048 / Math.max(iw, ih));
    drawWithWhiteBg(Math.max(1, Math.round(iw * vScale)), Math.max(1, Math.round(ih * vScale)));
    imageBase64 = canvas.toDataURL("image/jpeg", 0.95).split(",")[1] || "";
    mimeType = "image/jpeg";
  }

  // Create compact 180px thumbnail so sessionStorage stays well within quota
  const thumbScale = Math.min(1, 180 / Math.max(iw, ih));
  drawWithWhiteBg(Math.max(1, Math.round(iw * thumbScale)), Math.max(1, Math.round(ih * thumbScale)));
  const thumbnailDataUrl = canvas.toDataURL("image/jpeg", 0.8);

  return { imageBase64, mimeType, thumbnailDataUrl };
}
