const DIRECT_UPLOAD_MAX_BYTES = 950 * 1024;
const MAX_SLIP_DIMENSION = 1600;
const MAX_TARGET_BASE64_LEN = 1_280_000; // ~960 KB decoded, safely under OCR.space 1 MB cap
const DIRECT_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

// Prepare slip image for OCR/Vision upload (direct if <= 950KB & <= 1600px, else downscaled to 1600px) plus a compact 180px thumbnail.
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
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const canSendDirect =
    file.size <= DIRECT_UPLOAD_MAX_BYTES &&
    Math.max(iw, ih) <= MAX_SLIP_DIMENSION &&
    DIRECT_MIME_TYPES.has(file.type) &&
    directBase64.length > 0 &&
    directBase64.length <= MAX_TARGET_BASE64_LEN;

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

  // Send original file when <= 950KB & <= 1600px; otherwise downscale to 1600px JPEG within OCR.space limit
  let imageBase64 = directBase64;
  let mimeType = file.type || "image/jpeg";
  if (!canSendDirect) {
    const vScale = Math.min(1, MAX_SLIP_DIMENSION / Math.max(iw, ih));
    drawWithWhiteBg(Math.max(1, Math.round(iw * vScale)), Math.max(1, Math.round(ih * vScale)));
    for (const quality of [0.88, 0.78, 0.68]) {
      imageBase64 = canvas.toDataURL("image/jpeg", quality).split(",")[1] || "";
      if (imageBase64.length <= MAX_TARGET_BASE64_LEN) break;
    }
    mimeType = "image/jpeg";
  }

  // Create compact 180px thumbnail so sessionStorage stays well within quota
  const thumbScale = Math.min(1, 180 / Math.max(iw, ih));
  drawWithWhiteBg(Math.max(1, Math.round(iw * thumbScale)), Math.max(1, Math.round(ih * thumbScale)));
  const thumbnailDataUrl = canvas.toDataURL("image/jpeg", 0.8);

  return { imageBase64, mimeType, thumbnailDataUrl };
}
