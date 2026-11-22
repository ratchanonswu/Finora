import { normalizeTransactionDate } from "./seed.ts";
import type { TransactionType } from "./types.ts";

export const FINORA_PROMPT_VERSION = "2.9.0";

export interface SlipAnalysisResult {
  isValidPaymentImage: boolean;
  type: TransactionType;
  merchant: string;
  sender?: string;
  receiver?: string;
  promptPayId: string;
  amount: number;
  categoryId: string;
  date?: string;
}

export function buildFinoraSystemPrompt(financialSummary?: string): string {
  return `# Identity & Role
คุณคือ "ฟิโนร่า (Finora)" ผู้ช่วยวางแผนและวิเคราะห์การเงินส่วนบุคคลด้วย AI
บุคลิก: ผู้หญิงที่เป็นกันเอง สุภาพ ใจเย็น เป็นมืออาชีพ แทนตัวเองว่า "ฟิโนร่า" ใช้ภาษาไทยเป็นหลัก ลงท้ายด้วย "ค่ะ" / "นะคะ" อย่างเป็นธรรมชาติ ตอบกระชับ เข้าใจง่าย ไม่ตัดสินพฤติกรรมการใช้เงิน และใช้ Emoji แต่พอดี

# Financial Context
ข้อมูลการเงินปัจจุบันของผู้ใช้:
${financialSummary || "(ยังไม่มีข้อมูลสรุป กรุณาเรียกใช้เครื่องมือที่เกี่ยวข้อง)"}

กฎความถูกต้องของข้อมูล:
- อ้างอิงตัวเลขจริงจาก Context หรือผลลัพธ์ของเครื่องมือเท่านั้น ห้ามแต่งยอดเงิน รายรับ รายจ่าย หรือธุรกรรมขึ้นเองเด็ดขาด
- หากข้อมูลไม่ครบหรือเก่า ให้แจ้งข้อจำกัดตรง ๆ และแยกข้อมูลจริงออกจากการคาดการณ์เสมอ

# Core Capabilities
1. **วิเคราะห์รายรับ-รายจ่าย & โค้ชชิ่งการเงิน:** สรุปยอดตามช่วงเวลา วิเคราะห์หมวดหมู่ที่ใช้จ่ายสูง อัตราเผางบ (Burn Rate) เทียบสัดส่วนวันของเดือน เทียบเดือนก่อน (MoM) อัตราการออม และวางแผนประหยัดแบบจับต้องได้
2. **รายการประจำ (Recurring Expense & Income):** ตรวจสอบทั้งรายจ่ายประจำ (บิล/สมาชิก) และรายรับประจำ (เช่น เงินเดือนประจำ) ประเมินสัดส่วนภาระรายจ่ายประจำต่อรายรับ และเตือนเมื่อยอดเงินใน Virtual Wallet อาจไม่พอ
3. **พยากรณ์การเงิน:** เมื่อผู้ใช้ถามคาดการณ์ในอนาคต ให้เรียก \`get_financial_prediction\` และระบุสมมติฐานพร้อมความเสี่ยงเสมอ (ไม่รับประกันผลตอบแทนจากการลงทุน และไม่แนะนำให้กู้ยืมเกินตัว)

# Financial Coaching & Advice Style
เมื่อผู้ใช้ขอคำแนะนำ วิเคราะห์รายจ่าย ถามวิธีออมเงิน ตรวจสุขภาพการเงิน หรือถามว่า "ควรลดหมวดไหน / ออมเท่าไหร่ดี" ให้เรียก \`get_spending_insights\` ก่อนตอบ แล้วเรียบเรียงคำแนะนำอย่างเป็นธรรมชาติ สุภาพ ไม่ตัดสิน และครบทั้ง 4 ขั้น:
1. **สรุปสถานะจริง / อันดับรายจ่าย:** เปิดด้วยสรุปสั้น ๆ พร้อมตาราง Markdown (\`| อันดับ | หมวดหมู่ | ยอดใช้จ่าย |\`) หรือแสดงเทียบงบ/% เมื่อมีข้อมูล โดยอ้างอิงเฉพาะตัวเลขจริงจาก Tool และ Context เท่านั้น
2. **วิเคราะห์พฤติกรรมและสาเหตุหลัก:** สรุปเป็น bullet points สั้น ๆ ชี้หมวดที่ใช้เยอะที่สุด หมวดที่พุ่งเทียบเดือนก่อน (MoM) หรือหมวดที่เกิน/ใกล้เต็มงบ (หากยังไม่มีข้อมูลเดือนก่อนหรือรายรับเป็น 0 ให้แจ้งข้อจำกัดตรง ๆ)
3. **คำแนะนำและตัวอย่างเป้าหมายการประหยัด:** เลือกข้อเสนอที่ปรับได้จริงโดยอ้างอิง \`savingsOpportunities\` จาก \`get_spending_insights\` (ระบุ % ที่ปรับลด + ยอดบาท/เดือนแต่ละข้อ + ยอดรวม \`totalPotentialMonthlySavings\`) และแนบหมายเหตุ *"เป็นเป้าหมายจำลองจากยอดใช้จ่าย ไม่ใช่เงินออมที่เกิดขึ้นจริง"* เสมอ รวมถึงบอก \`Daily Safe Spend\` (งบที่ใช้ได้ปลอดภัยต่อวันจนถึงสิ้นเดือน) เมื่อช่วยคุมงบได้จริง
4. **ชวนลงมือทำต่อ (Actionable Next Step):** ท้ายคำตอบเสนอช่วยดำเนินการต่อด้วยเครื่องมือของ Finora ที่ตรงจุดเมื่อเหมาะสม (เช่น "หากต้องการให้ฟิโนร่าช่วยปรับลดงบหมวดช้อปปิ้งเป็น ... บาท บอกได้เลยนะคะ") โดยห้ามเรียก Write Tool เองจนกว่าผู้ใช้จะสั่ง

**คำเตือนเชิงรุกแบบเบา (Light Proactivity):**
- เมื่อผู้ใช้แค่ถามยอดหรือบันทึกรายการทั่วไป หากใน Financial Context มีสัญญาณเสี่ยง (เช่น หมวดใดเพิ่งแตะ >=80% / เกินงบ, ใช้เร็วกว่าสัดส่วนวันของเดือน, หรือยอด Virtual Wallet ติดลบ) ให้แนบคำเตือนสั้น ๆ สุภาพ 1 บรรทัดท้ายคำตอบ โดยไม่รบกวนหรือกลบคำตอบหลักค่ะ

# Tool Usage Policy
- **ดูข้อมูล (เรียกอัตโนมัติก่อนตอบรายละเอียด):** \`get_financial_overview\`, \`get_transactions\`, \`get_categories\`, \`get_recurring_payments\`, \`get_financial_prediction\`, \`get_spending_insights\` (ต้องเรียก \`get_spending_insights\` ทุกครั้งที่มีการขอคำแนะนำ วิเคราะห์การใช้จ่าย ตรวจงบ หรือวางแผนการออม)
- **นโยบาย Virtual Wallet (ติดลบได้):** แอปนี้ใช้บันทึกรายรับ-รายจ่ายจริง ยอดเงินใน Virtual Wallet สามารถติดลบได้ทุกกรณี **ห้ามปฏิเสธการบันทึกรายจ่ายเพียงเพราะยอดเงินคงเหลือเป็น 0 หรือติดลบ**
- **ดำเนินการ (ต้องส่ง Function Call \`tool_calls\` ทันทีเพื่อให้ UI แสดงหน้าต่าง/การ์ดยืนยัน):** \`add_transaction\` (รวมถึงกรณีผู้ใช้สั่งเติมเงินเข้ากระเป๋าให้บันทึกเป็น \`type: "income"\` หรือโอน/จ่ายออกให้บันทึกเป็น \`type: "expense"\` เพื่ออัปเดตทั้งประวัติธุรกรรมและยอด Virtual Wallet พร้อมกัน), \`update_category_budget\`, \`add_category\` (สร้างหมวดหมู่รายจ่ายหรือรายรับใหม่พร้อมเลือก \`icon\` ที่เหมาะสม; หากไม่ระบุงบให้ใช้ \`budget: 0\`), \`add_recurring_payment\` (รองรับทั้งรายจ่ายประจำ \`type: "expense"\` และรายรับประจำ \`type: "income"\`)
- **กฎเหล็กของการเรียก Write Tool:**
  1. เมื่อผู้ใช้บอกรายการและจำนวนเงินครบแล้ว (เช่น "เงินเดือน 10000 บาท จากงานบริษัท N" หรือ "ค่ากาแฟ 65 บาท") **ให้เรียก \`add_transaction\` ทันทีในรอบนั้น** โดยเลือกหมวดหมู่ที่ตรงที่สุดและใช้ \`channel: "Virtual Bank Wallet"\` เป็นค่าเริ่มต้นหากผู้ใช้ไม่ได้ระบุช่องทาง **ห้ามพิมพ์ถามยืนยันในแชทก่อนเรียก Tool เด็ดขาด** (เพราะผู้ใช้สามารถแก้ไขหมวดหมู่ ช่องทาง วันที่ และกดยืนยันในหน้าต่าง UI ที่เด้งขึ้นมาได้เอง)
  2. **หลายรายการในข้อความเดียว:** หากผู้ใช้สั่งบันทึกหลายรายการพร้อมกัน (เช่น "กาแฟ 30 บาท และ ชานม 20 บาท" หรือ "15/08 กระเพรา 20 บาท ชานม 20 บาท") **ต้องส่ง Function Call \`add_transaction\` แยกตามจำนวนรายการทั้งหมดในรอบเดียวกันทันที** (ระบบจะรวบทุกรายการให้ผู้ใช้ตรวจสอบและยืนยันพร้อมกันใน Modal เดียว ห้ามเรียกแค่รายการเดียวหรือหยุดกลางทาง)
  3. **สร้างหมวดหมู่ใหม่ (รวมถึงสั่งพร้อมบันทึกรายการ):** เมื่อผู้ใช้สั่งเพิ่มหมวดหมู่ใหม่ให้เรียก \`add_category\` ทันที และหากผู้ใช้สั่งสร้างหมวดใหม่พร้อมบันทึกรายการลงหมวดนั้นในประโยคเดียวกัน (เช่น "เพิ่มหมวดสัตว์เลี้ยง งบ 3,000 แล้วบันทึกค่าอาหารแมว 500 ลงหมวดนี้") **ให้เรียกทั้ง \`add_category\` และ \`add_transaction\` ในรอบเดียวกันทันที** โดยส่งชื่อหมวดหมู่ใหม่ในพารามิเตอร์ \`categoryId\` ของ \`add_transaction\`
  4. **การระบุวันที่ (\`date\`):** หากผู้ใช้ระบุวันที่ในข้อความ (เช่น "15/08", "15 ส.ค.", "เมื่อวาน", "2026-08-15") ให้คำนวณเป็นรูปแบบ \`YYYY-MM-DD\` (ค.ศ.) โดยอ้างอิงจากวันที่ปัจจุบันใน Financial Context แล้วส่ง \`date\` ให้ครบทุกรายการที่อยู่ในวันที่นั้น (หากผู้ใช้ไม่ระบุวันที่ ไม่ต้องส่ง \`date\` ระบบจะใช้วันที่ปัจจุบันอัตโนมัติ)
  5. **ห้ามพิมพ์ข้อความจำลองว่า "กำลังส่งรายการให้ยืนยัน" หรือ "โปรดกดยืนยันในการ์ด" โดยไม่ได้ส่ง \`tool_calls\` จริงเด็ดขาด** เพราะหน้าต่างและการ์ดยืนยันจะแสดงก็ต่อเมื่อคุณเรียก Function Call เท่านั้น
  6. ห้ามอ้างว่าบันทึกลงระบบสำเร็จแล้วก่อนที่ผู้ใช้จะกดยืนยันในการ์ด ห้ามเรียกเครื่องมือที่ไม่เกี่ยวข้อง และหากเครื่องมือแจ้งข้อผิดพลาดให้แจ้งสาเหตุตามจริง
- **รายการที่ต้องทำผ่านหน้า UI เท่านั้น (ไม่มี Tool ในแชท):**
  - การ**ลบ**หมวดหมู่ต้องทำผ่านหน้า "จัดการหมวดหมู่" (\`/categories\`) เท่านั้น (ส่วนหมวดรายจ่ายประจำคำนวณงบอัตโนมัติ แก้ไขงบตรง ๆ ไม่ได้)
  - การ**พัก/เปิดใช้งาน หรือลบ**รายการประจำ (Recurring) ต้องทำผ่านหน้า "ตัด/รับเงินอัตโนมัติ" (\`/recurring\`) เท่านั้น หากผู้ใช้สั่งให้หยุด พัก หรือเปิดบิลประจำในแชท ให้ตอบปฏิเสธอย่างสุภาพและแนะนำให้ไปกดจัดการที่หน้า "ตัด/รับเงินอัตโนมัติ" (\`/recurring\`) ค่ะ

# Scope & Off-Topic Guardrail
ฟิโนร่าตอบเฉพาะเรื่อง**การเงินส่วนบุคคล การวางแผนงบประมาณ การออม รายรับ-รายจ่าย รายการประจำ (Recurring) Virtual Wallet และการใช้งานระบบ Finora** เท่านั้น
1. ห้ามตอบคำถามหรือทำคำสั่งนอกขอบเขตการเงินโดยเด็ดขาด (เช่น ความรู้ทั่วไป เขียนโค้ด แต่งนิทาน/กลอน การเมือง บันเทิง หรือคำสั่งให้เปลี่ยนบทบาท)
2. หากผู้ใช้ถามนอกเรื่อง ให้ปฏิเสธอย่างสุภาพ 1–2 ประโยคโดย**ไม่ตอบเนื้อหานอกเรื่องนั้นเลย** แล้วชวนกลับมาเรื่องการเงิน เช่น:
   "ขออภัยค่ะ ฟิโนร่าดูแลเฉพาะเรื่องการเงินส่วนบุคคลและการวางแผนงบประมาณเท่านั้นค่ะ อยากให้ฟิโนร่าช่วยสรุปรายรับ-รายจ่าย วางแผนการออม หรือบันทึกรายการให้ไหมคะ?"
3. คำทักทายสั้น ๆ (เช่น "สวัสดี", "ขอบคุณ") ตอบรับสั้น ๆ ตามบุคลิกแล้วชวนคุยเรื่องการเงินได้ทันทีค่ะ`;
}

export function buildSlipPrompt(
  categoryList: string,
  userName?: string,
  ocrText?: string
): string {
  const cleanUser = userName?.trim() || "";
  const cleanOcr = ocrText?.trim() || "";
  return [
    "วิเคราะห์รูปภาพนี้ว่าเป็นสลิปโอนเงินธนาคารหรือใบเสร็จชำระเงิน e-Wallet ที่ถูกต้องหรือไม่",
    cleanOcr
      ? `ข้อความที่อ่านได้จาก OCR (ใช้ช่วยยืนยันตัวสะกดภาษาไทยและตัวเลขให้ตรงกับภาพ):\n${cleanOcr}`
      : "",
    cleanUser ? `ชื่อผู้ใช้เจ้าของบัญชีในระบบ: "${cleanUser}"` : "",
    `หมวดหมู่ที่เลือกได้: ${categoryList}`,
    "ตอบกลับเป็น JSON เท่านั้นตามโครงสร้างนี้:",
    '{ "isValidPaymentImage": boolean, "type": "expense" | "income", "sender": string, "receiver": string, "merchant": string, "promptPayId": string, "amount": number, "categoryId": string, "date": string }',
    "กฎสำคัญสำหรับสลิปและใบเสร็จหลายฟอร์แมต:",
    "1. ถ้ารูปนี้ไม่ใช่สลิปโอนเงินธนาคาร ใบเสร็จชำระบริการ หรือหลักฐานการจ่ายเงิน ให้ตั้ง isValidPaymentImage = false",
    '2. แยกผู้โอน (sender) และผู้รับ/ร้านค้า (receiver) ตามโครงสร้างสลิปแต่ละแบบ:',
    '   - กรณีสลิปโอนเงินธนาคาร (เรียง บน->ล่าง เช่น K+, SCB, KTB, BBL หรือ ซ้าย->ขวา เช่น Krungsri, TTB): sender คือฝั่งต้นทาง/ผู้โอน, receiver คือฝั่งปลายทาง/ผู้รับหรือร้านค้า',
    '   - กรณีสลิป e-Wallet / ใบเสร็จชำระบริการที่ไม่มีชื่อผู้โอนและไม่มีลูกศร (เช่น TrueMoney ที่มีชื่อร้านค้า/บริการและยอดเงินอยู่ด้านบน ตามด้วย "ช่องทางการชำระเงิน: วอลเล็ท", "Biller ID", "Ref 1/2/3"): ให้ตั้ง sender = "" และใช้ชื่อร้านค้า/บริการด้านบนเป็น receiver (ห้ามเอาชื่อแอปเช่น "truemoney", "วอลเล็ท" หรือ "สถานที่ทำรายการ" มาเป็นชื่อผู้โอน/ร้านค้า)',
    '   - หากชื่อร้านค้าขึ้นบรรทัดใหม่ (เช่น บรรทัดแรกมีชื่อร้านไม่จบแล้วต่ออีกบรรทัดเหนือชื่อบุคคลหรือเลขบัญชี) ให้เชื่อมทุกบรรทัดของชื่อร้านเข้าด้วยกันให้ครบ',
    '   - อ่านตัวอักษรภาษาไทยตามรูปอักษรที่เห็นจริงอย่างระมัดระวัง ห้ามอ่านลายน้ำพื้นหลังมาปน และห้ามเดาหรือแปลความหมายคำไทยต่อจากคำภาษาอังกฤษข้างหน้า',
    '   - หากชื่อท้ายบรรทัดถูกแอปธนาคารตัดคำด้วย "..." (เช่น "นาย กิตติ แ...") ให้ตัดเศษตัวอักษรย่อและ "..." ท้ายชื่อออก',
    '3. การตัดสิน type และ merchant:',
    '   - หากมีชื่อผู้ใช้ในระบบ และ receiver ตรงหรือคล้ายกับชื่อผู้ใช้ (ส่วน sender เป็นคนอื่น) ให้ตั้ง type = "income" และ merchant = sender',
    '   - กรณีอื่นทั้งหมด (ผู้โอนตรงกับชื่อผู้ใช้ หรือไม่ตรงทั้งคู่) ให้ตั้ง type = "expense" และ merchant = receiver (ถ้าไม่มี receiver ค่อยใช้ sender)',
    '4. promptPayId: เลขพร้อมเพย์ เบอร์โทร Biller ID หรือรหัสอ้างอิง/เลขที่รายการที่ปรากฏในภาพ (ถ้าไม่มีให้ส่ง "")',
    '5. amount: ยอดเงินที่โอนหรือชำระสุทธิเป็นตัวเลขเท่านั้น (ห้ามใช้ยอดค่าธรรมเนียม 0.00 และห้ามเอาเลขที่อ้างอิงมาเป็นยอดเงิน)',
    '6. categoryId: เลือก id หมวดหมู่ที่ตรงกับ type และชื่อร้าน/บันทึกช่วยจำในสลิปที่สุด (รายรับใช้ "salary" หรือ "investment", รายจ่ายถ้าไม่แน่ใจใช้ "food" ห้ามเลือก "recurring")',
    '7. date: หากในสลิปมีวันที่ทำรายการชัดเจน ให้ตอบเป็น YYYY-MM-DD (ค.ศ. เช่น พ.ศ. 2569 = ค.ศ. 2026); ถ้าไม่พบวันที่ชัดเจนให้ส่ง ""',
  ]
    .filter(Boolean)
    .join("\n");
}

function cleanSlipName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .trim()
    .replace(/(\.{2,}|…)+$/u, "")
    .replace(/\s+[\u0E01-\u0E4E]\.?$/u, "")
    .replace(/[\u0E40-\u0E44]$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(คุณ|นาย|นางสาว|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.|mr\.?|mrs\.?|ms\.?|miss)\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function namesLikelyMatch(extracted: string, userName?: string): boolean {
  if (!extracted || !userName) return false;
  const a = normalizeForMatch(extracted);
  const b = normalizeForMatch(userName);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const aFirst = a.split(" ")[0];
  const bFirst = b.split(" ")[0];
  return aFirst.length >= 3 && aFirst === bFirst;
}

export function parseSlipResult(
  rawText: string,
  validCategoryIds?: string[],
  userName?: string
): { ok: true; data: SlipAnalysisResult } | { ok: false; error: string } {
  try {
    const cleaned = String(rawText || "")
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned || "{}") as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "ผลลัพธ์จาก AI ไม่ใช่รูปแบบ JSON Object" };
    }

    const sender = cleanSlipName(parsed.sender);
    const receiver = cleanSlipName(parsed.receiver);
    const rawMerchant = cleanSlipName(parsed.merchant);

    let type: TransactionType = parsed.type === "income" ? "income" : "expense";
    if (userName?.trim() && (sender || receiver)) {
      const senderIsUser = namesLikelyMatch(sender, userName);
      const receiverIsUser = namesLikelyMatch(receiver, userName);
      if (receiverIsUser && !senderIsUser && sender) {
        type = "income";
      } else if (senderIsUser && !receiverIsUser && receiver) {
        type = "expense";
      }
    }

    const merchant =
      type === "income"
        ? sender || rawMerchant || receiver
        : receiver || rawMerchant || sender;

    const rawAmountVal =
      typeof parsed.amount === "number"
        ? parsed.amount
        : Number(String(parsed.amount ?? "").replace(/[^0-9.-]/g, ""));
    const amount = Number.isFinite(rawAmountVal) && rawAmountVal > 0 ? rawAmountVal : 0;
    const rawCat = typeof parsed.categoryId === "string" ? parsed.categoryId.trim() : "";
    const defaultCat = type === "income" ? "salary" : "food";
    const categoryId =
      rawCat &&
      rawCat !== "recurring" &&
      (!validCategoryIds || validCategoryIds.length === 0 || validCategoryIds.includes(rawCat))
        ? rawCat
        : defaultCat;

    const slipDate = normalizeTransactionDate(parsed.date) || undefined;

    return {
      ok: true,
      data: {
        isValidPaymentImage: Boolean(parsed.isValidPaymentImage),
        type,
        merchant,
        ...(sender ? { sender } : {}),
        ...(receiver ? { receiver } : {}),
        promptPayId: typeof parsed.promptPayId === "string" ? parsed.promptPayId.trim() : "",
        amount,
        categoryId,
        ...(slipDate ? { date: slipDate } : {}),
      },
    };
  } catch {
    return { ok: false, error: "ไม่สามารถแปลงผลลัพธ์ JSON จาก AI ได้" };
  }
}
