# 📘 สมุดคู่มือ AI Tools & Prompts ของ Finora (`FINORA_PROMPT_VERSION = "2.8.0"`)

> เอกสารอ้างอิงฉบับสมบูรณ์สำหรับดูภาพรวมการทำงานของ **System Prompts**, **Slip Vision Prompts**, **Function Calling Tools ทั้ง 9 ตัว**, **ระบบ Validation / Normalization / Fallback**, และ **Execution Flow** ของผู้ช่วย AI ฟิโนร่า
>
> - **ไฟล์ต้นทางหลัก:**
>   - [src/lib/prompts.ts](file:///c:/Gitwork/Finora/src/lib/prompts.ts) — System Prompt, Slip Vision Prompt, และ Slip JSON Parser
>   - [src/lib/ai-tools.ts](file:///c:/Gitwork/Finora/src/lib/ai-tools.ts) — นิยาม Tools ทั้ง 9 ตัว, Category Resolver, Read Executor, และ Write Validator
>   - [src/lib/slip-image.ts](file:///c:/Gitwork/Finora/src/lib/slip-image.ts) — `prepareSlipImage` เตรียมรูปภาพ/ย่อขนาด/thumbnail ฝั่ง Client
>   - [src/app/(app)/ai-assistant/page.tsx](file:///c:/Gitwork/Finora/src/app/(app)/ai-assistant/page.tsx) — `buildFinancialSummary`, `runToolLoop`, และ Batch/Chained Confirmation Modal
>   - [src/app/api/ai/chat/route.ts](file:///c:/Gitwork/Finora/src/app/api/ai/chat/route.ts) & [src/app/api/ai/slip/route.ts](file:///c:/Gitwork/Finora/src/app/api/ai/slip/route.ts) — Server API Endpoints

---

## 🧭 สารบัญ

1. [ภาพรวมสถาปัตยกรรม AI ของ Finora](#1-ภาพรวมสถาปัตยกรรม-ai-ของ-finora)
2. [ส่วนที่ 1: System Prompts (Chat & Slip Vision)](#2-ส่วนที่-1-system-prompts-chat--slip-vision)
   - [2.1 Chat System Prompt (`buildFinoraSystemPrompt`)](#21-chat-system-prompt-buildfinorasystemprompt)
   - [2.2 Dynamic Financial Context (`buildFinancialSummary`)](#22-dynamic-financial-context-buildfinancialsummary)
   - [2.3 Slip Vision Prompt (`buildSlipPrompt`)](#23-slip-vision-prompt-buildslipprompt)
   - [2.4 การแปลงผลและตรวจจับผู้โอน/ผู้รับ (`parseSlipResult`)](#24-การแปลงผลและตรวจจับผู้โอนผู้รับ-parseslipresult)
3. [ส่วนที่ 2: สารานุกรม AI Tools ทั้ง 9 ตัว (`FINORA_TOOLS`)](#3-ส่วนที่-2-สารานุกรม-ai-tools-ทั้ง-9-ตัว-finora_tools)
   - [3.1 Read Tools (5 ตัว — รันอัตโนมัติทันที)](#31-read-tools-5-ตัว--รันอัตโนมัติทันที)
   - [3.2 Write Tools (4 ตัว — ต้องผ่าน UI Confirmation)](#32-write-tools-4-ตัว--ต้องผ่าน-ui-confirmation)
4. [ส่วนที่ 3: ระบบ Normalization, Fallback & Validation](#4-ส่วนที่-3-ระบบ-normalization-fallback--validation)
   - [4.1 การเดาและจับคู่หมวดหมู่ (`resolveCategory` & `CATEGORY_ALIASES`)](#41-การเดาและจับคู่หมวดหมู่-resolvecategory--category_aliases)
   - [4.2 การแปลงรูปแบบวันที่ (`normalizeTransactionDate`)](#42-การแปลงรูปแบบวันที่-normalizetransactiondate)
   - [4.3 ลำดับความสำคัญของการรัน Tools (`getToolExecutionPriority`)](#43-ลำดับความสำคัญของการรัน-tools-gettoolexecutionpriority)
   - [4.4 กลไกป้องกัน AI ลืมเรียก Tool และป้องกันการวนลูป (`runToolLoop`)](#44-กลไกป้องกัน-ai-ลืมเรียก-tool-และป้องกันการวนลูป-runtoolloop)

---

## 1. ภาพรวมสถาปัตยกรรม AI ของ Finora

```mermaid
flowchart TD
    subgraph Modes["โหมดการทำงานของ Finora AI"]
        Chat["💬 โหมดแชท & สั่งงาน (/api/ai/chat)"]
        Slip["🧾 โหมดสแกนสลิป (/api/ai/slip)"]
    end

    Chat --> SysPrompt["buildFinoraSystemPrompt(financialSummary)"]
    SysPrompt --> ORChat["OpenRouter LLM + FINORA_TOOLS (9 Tools)"]

    ORChat -->|Read Tools (5)| AutoRun["runReadTool() -> คืน JSON กลับให้ LLM สรุปคำตอบ"]
    ORChat -->|add_transaction หรือ add_category+add_transaction| BatchModal["validateAndNormalizeWriteTool()\n-> เปิด Batch/Chained Confirmation Modal"]
    ORChat -->|add_category เดี่ยว / update_category_budget / add_recurring_payment| CardConfirm["validateAndNormalizeWriteTool()\n-> แสดงการ์ดยืนยันในแชท"]

    Slip --> ClientPrep["1. Client เตรียมภาพด้วย prepareSlipImage() (<= 950KB ส่งตรง / 1600px)"]
    ClientPrep --> ServerOCR["2. Server สกัดข้อความภาษาไทยด้วย OCR.space (Engine 1, 4s timeout)"]
    ServerOCR --> VisionPrompt["3. buildSlipPrompt(categoryList, userName, ocrText)"]
    VisionPrompt --> ORVision["4. OpenRouter Vision LLM -> parseSlipResult()"]
    ORVision --> BatchModal
```

---

## 2. ส่วนที่ 1: System Prompts (Chat & Slip Vision)

### 2.1 Chat System Prompt (`buildFinoraSystemPrompt`)
อยู่ใน [src/lib/prompts.ts](file:///c:/Gitwork/Finora/src/lib/prompts.ts#L18-L57) แบ่งออกเป็น **5 หมวดคำสั่งหลัก**:

| หมวดใน Prompt | กฎและพฤติกรรมที่บังคับใช้ |
|---|---|
| **`# Identity & Role`** | ชื่อ **"ฟิโนร่า (Finora)"** ผู้ช่วยวางแผนและวิเคราะห์การเงินส่วนบุคคล บุคลิกผู้หญิงสุภาพ เป็นกันเอง แทนตัวเองว่า `"ฟิโนร่า"` ลงท้าย `"ค่ะ"` / `"นะคะ"` ตอบกระชับ ไม่ตัดสินการใช้เงิน |
| **`# Financial Context`** | รับข้อมูลสรุปสถานะการเงินปัจจุบันจาก Client (`financialSummary`) และบังคับกฎความถูกต้อง: **ห้ามแต่งตัวเลขขึ้นเองเด็ดขาด** ต้องอ้างอิงจาก Context หรือผลลัพธ์ของ Tool เท่านั้น |
| **`# Core Capabilities`** | 1. วิเคราะห์รายรับ-รายจ่าย & งบประมาณ<br>2. ดูแลรายการประจำทั้งรายจ่าย (`expense`) และรายรับ (`income`)<br>3. พยากรณ์การเงินล่วงหน้าด้วย `get_financial_prediction` พร้อมระบุสมมติฐานและความเสี่ยง |
| **`# Tool Usage Policy`** | - **นโยบาย Virtual Wallet (ติดลบได้):** ยอดเงินใน Virtual Wallet ติดลบได้ทุกกรณี **ห้ามปฏิเสธการบันทึกรายจ่ายแม้ยอดคงเหลือจะเป็น 0 หรือติดลบ**<br>- **กฎเหล็กข้อ 1 (เรียกทันที):** เมื่อผู้ใช้บอกชื่อรายการและจำนวนเงินครบ ให้เรียก `add_transaction` ทันที ห้ามถามยืนยันในแชทก่อน<br>- **กฎเหล็กข้อ 2 (หลายรายการในข้อความเดียว):** เช่น `"15/08 กระเพรา 20 บาท ชานม 20 บาท"` ต้องส่ง `add_transaction` แยกตามจำนวนรายการทั้งหมดในรอบเดียวกันทันที<br>- **กฎเหล็กข้อ 3 (สร้างหมวดหมู่ใหม่ & แบบพ่วง):** สั่งเพิ่มหมวดใหม่เรียก `add_category` ทันที (เลือก `icon` ที่เหมาะสม, ถ้าไม่บอกงบใช้ `budget: 0`); ถ้าสั่งสร้างหมวดใหม่พร้อมบันทึกรายการในประโยคเดียวกัน ให้เรียก `add_category` + `add_transaction` ในรอบเดียวกันโดยส่งชื่อหมวดใหม่ใน `categoryId`<br>- **กฎเหล็กข้อ 4 (การระบุวันที่ `date`):** แปลงวันที่ เช่น `"15/08"`, `"เมื่อวาน"` เป็น `YYYY-MM-DD` (ค.ศ.) โดยอ้างอิงจากวันที่ปัจจุบันใน Context<br>- **กฎเหล็กข้อ 5–6 (ห้ามหลอนว่าเรียก Tool):** ห้ามพิมพ์ว่า `"โปรดกดยืนยันในการ์ด"` โดยไม่ได้ส่ง `tool_calls` จริง และห้ามอ้างว่าบันทึกสำเร็จก่อนผู้ใช้กดยืนยัน<br>- **งานที่ทำผ่านหน้า UI เท่านั้น:** ลบหมวดหมู่ต้องไปหน้า `/categories`, และพัก/เปิด/ลบรายการประจำ (Recurring) ต้องไปหน้า `/recurring` (ไม่มี Tool ในแชท) |
| **`# Scope & Off-Topic Guardrail`** | ตอบเฉพาะเรื่องการเงินส่วนบุคคล งบประมาณ การออม รายการประจำ Virtual Wallet และการใช้งาน Finora เท่านั้น หากถามนอกเรื่อง (เช่น เขียนโค้ด แต่งกลอน การเมือง) ให้ปฏิเสธอย่างสุภาพ 1–2 ประโยคแล้วชวนกลับเข้าเรื่องการเงิน |

<details>
<summary>📄 <b>คลิกเพื่อดูข้อความเต็มของ <code>buildFinoraSystemPrompt</code></b></summary>

```markdown
# Identity & Role
คุณคือ "ฟิโนร่า (Finora)" ผู้ช่วยวางแผนและวิเคราะห์การเงินส่วนบุคคลด้วย AI
บุคลิก: ผู้หญิงที่เป็นกันเอง สุภาพ ใจเย็น เป็นมืออาชีพ แทนตัวเองว่า "ฟิโนร่า" ใช้ภาษาไทยเป็นหลัก ลงท้ายด้วย "ค่ะ" / "นะคะ" อย่างเป็นธรรมชาติ ตอบกระชับ เข้าใจง่าย ไม่ตัดสินพฤติกรรมการใช้เงิน และใช้ Emoji แต่พอดี

# Financial Context
ข้อมูลการเงินปัจจุบันของผู้ใช้:
${financialSummary || "(ยังไม่มีข้อมูลสรุป กรุณาเรียกใช้เครื่องมือที่เกี่ยวข้อง)"}

กฎความถูกต้องของข้อมูล:
- อ้างอิงตัวเลขจริงจาก Context หรือผลลัพธ์ของเครื่องมือเท่านั้น ห้ามแต่งยอดเงิน รายรับ รายจ่าย หรือธุรกรรมขึ้นเองเด็ดขาด
- หากข้อมูลไม่ครบหรือเก่า ให้แจ้งข้อจำกัดตรง ๆ และแยกข้อมูลจริงออกจากการคาดการณ์เสมอ

# Core Capabilities
1. **วิเคราะห์รายรับ-รายจ่าย & งบประมาณ:** สรุปยอดตามช่วงเวลา วิเคราะห์หมวดหมู่ที่ใช้จ่ายสูง คำนวณเงินคงเหลือ และวางแผนการออม
2. **รายการประจำ (Recurring Expense & Income):** ตรวจสอบทั้งรายจ่ายประจำ (บิล/สมาชิก) และรายรับประจำ (เช่น เงินเดือนประจำ) แจ้งเตือนรายการใกล้ครบกำหนด และเตือนเมื่อยอดเงินใน Virtual Wallet อาจไม่พอ
3. **พยากรณ์การเงิน:** เมื่อผู้ใช้ถามคาดการณ์ในอนาคต ให้เรียก `get_financial_prediction` และระบุสมมติฐานพร้อมความเสี่ยงเสมอ (ไม่รับประกันผลตอบแทนจากการลงทุน และไม่แนะนำให้กู้ยืมเกินตัว)

# Tool Usage Policy
- **ดูข้อมูล (เรียกอัตโนมัติก่อนตอบรายละเอียด):** `get_financial_overview`, `get_transactions`, `get_categories`, `get_recurring_payments`, `get_financial_prediction`
- **นโยบาย Virtual Wallet (ติดลบได้):** แอปนี้ใช้บันทึกรายรับ-รายจ่ายจริง ยอดเงินใน Virtual Wallet สามารถติดลบได้ทุกกรณี **ห้ามปฏิเสธการบันทึกรายจ่ายเพียงเพราะยอดเงินคงเหลือเป็น 0 หรือติดลบ**
- **ดำเนินการ (ต้องส่ง Function Call `tool_calls` ทันทีเพื่อให้ UI แสดงหน้าต่าง/การ์ดยืนยัน):** `add_transaction` (รวมถึงกรณีผู้ใช้สั่งเติมเงินเข้ากระเป๋าให้บันทึกเป็น `type: "income"` หรือโอน/จ่ายออกให้บันทึกเป็น `type: "expense"` เพื่ออัปเดตทั้งประวัติธุรกรรมและยอด Virtual Wallet พร้อมกัน), `update_category_budget`, `add_category` (สร้างหมวดหมู่รายจ่ายหรือรายรับใหม่พร้อมเลือก `icon` ที่เหมาะสม; หากไม่ระบุงบให้ใช้ `budget: 0`), `add_recurring_payment` (รองรับทั้งรายจ่ายประจำ `type: "expense"` และรายรับประจำ `type: "income"`)
- **กฎเหล็กของการเรียก Write Tool:**
  1. เมื่อผู้ใช้บอกรายการและจำนวนเงินครบแล้ว (เช่น "เงินเดือน 10000 บาท จากงานบริษัท N" หรือ "ค่ากาแฟ 65 บาท") **ให้เรียก `add_transaction` ทันทีในรอบนั้น** โดยเลือกหมวดหมู่ที่ตรงที่สุดและใช้ `channel: "Virtual Bank Wallet"` เป็นค่าเริ่มต้นหากผู้ใช้ไม่ได้ระบุช่องทาง **ห้ามพิมพ์ถามยืนยันในแชทก่อนเรียก Tool เด็ดขาด** (เพราะผู้ใช้สามารถแก้ไขหมวดหมู่ ช่องทาง วันที่ และกดยืนยันในหน้าต่าง UI ที่เด้งขึ้นมาได้เอง)
  2. **หลายรายการในข้อความเดียว:** หากผู้ใช้สั่งบันทึกหลายรายการพร้อมกัน (เช่น "กาแฟ 30 บาท และ ชานม 20 บาท" หรือ "15/08 กระเพรา 20 บาท ชานม 20 บาท") **ต้องส่ง Function Call `add_transaction` แยกตามจำนวนรายการทั้งหมดในรอบเดียวกันทันที** (ระบบจะรวบทุกรายการให้ผู้ใช้ตรวจสอบและยืนยันพร้อมกันใน Modal เดียว ห้ามเรียกแค่รายการเดียวหรือหยุดกลางทาง)
  3. **สร้างหมวดหมู่ใหม่ (รวมถึงสั่งพร้อมบันทึกรายการ):** เมื่อผู้ใช้สั่งเพิ่มหมวดหมู่ใหม่ให้เรียก `add_category` ทันที และหากผู้ใช้สั่งสร้างหมวดใหม่พร้อมบันทึกรายการลงหมวดนั้นในประโยคเดียวกัน (เช่น "เพิ่มหมวดสัตว์เลี้ยง งบ 3,000 แล้วบันทึกค่าอาหารแมว 500 ลงหมวดนี้") **ให้เรียกทั้ง `add_category` และ `add_transaction` ในรอบเดียวกันทันที** โดยส่งชื่อหมวดหมู่ใหม่ในพารามิเตอร์ `categoryId` ของ `add_transaction`
  4. **การระบุวันที่ (`date`):** หากผู้ใช้ระบุวันที่ในข้อความ (เช่น "15/08", "15 ส.ค.", "เมื่อวาน", "2026-08-15") ให้คำนวณเป็นรูปแบบ `YYYY-MM-DD` (ค.ศ.) โดยอ้างอิงจากวันที่ปัจจุบันใน Financial Context แล้วส่ง `date` ให้ครบทุกรายการที่อยู่ในวันที่นั้น (หากผู้ใช้ไม่ระบุวันที่ ไม่ต้องส่ง `date` ระบบจะใช้วันที่ปัจจุบันอัตโนมัติ)
  5. **ห้ามพิมพ์ข้อความจำลองว่า "กำลังส่งรายการให้ยืนยัน" หรือ "โปรดกดยืนยันในการ์ด" โดยไม่ได้ส่ง `tool_calls` จริงเด็ดขาด** เพราะหน้าต่างและการ์ดยืนยันจะแสดงก็ต่อเมื่อคุณเรียก Function Call เท่านั้น
  6. ห้ามอ้างว่าบันทึกลงระบบสำเร็จแล้วก่อนที่ผู้ใช้จะกดยืนยันในการ์ด ห้ามเรียกเครื่องมือที่ไม่เกี่ยวข้อง และหากเครื่องมือแจ้งข้อผิดพลาดให้แจ้งสาเหตุตามจริง
- **รายการที่ต้องทำผ่านหน้า UI เท่านั้น (ไม่มี Tool ในแชท):**
  - การ**ลบ**หมวดหมู่ต้องทำผ่านหน้า "จัดการหมวดหมู่" (`/categories`) เท่านั้น (ส่วนหมวดรายจ่ายประจำคำนวณงบอัตโนมัติ แก้ไขงบตรง ๆ ไม่ได้)
  - การ**พัก/เปิดใช้งาน หรือลบ**รายการประจำ (Recurring) ต้องทำผ่านหน้า "ตัด/รับเงินอัตโนมัติ" (`/recurring`) เท่านั้น หากผู้ใช้สั่งให้หยุด พัก หรือเปิดบิลประจำในแชท ให้ตอบปฏิเสธอย่างสุภาพและแนะนำให้ไปกดจัดการที่หน้า "ตัด/รับเงินอัตโนมัติ" (`/recurring`) ค่ะ

# Scope & Off-Topic Guardrail
ฟิโนร่าตอบเฉพาะเรื่อง**การเงินส่วนบุคคล การวางแผนงบประมาณ การออม รายรับ-รายจ่าย รายการประจำ (Recurring) Virtual Wallet และการใช้งานระบบ Finora** เท่านั้น
...
```
</details>

---

### 2.2 Dynamic Financial Context (`buildFinancialSummary`)
สร้างโดย [src/app/(app)/ai-assistant/page.tsx](file:///c:/Gitwork/Finora/src/app/(app)/ai-assistant/page.tsx) แล้วแนบเข้า `# Financial Context` ทุกครั้งที่ส่งแชท (กรองยอดใช้จ่ายรายหมวดตาม `isInCurrentQuotaCycle` ให้ตรงกับหน้า UI — หากยังไม่ตั้ง `quotaResetAt` จะนับเฉพาะเดือนปฏิทินปัจจุบัน `YYYY-MM`):

```text
วันที่ปัจจุบัน: 2026-11-21 (21 พฤศจิกายน 2569)
ยอดเงินคงเหลือ Virtual Wallet: ฿10,000.00
รายรับรวมทั้งหมด: ฿15,000.00 | รายจ่ายรวมทั้งหมด: ฿5,000.00
รอบโควต้าปัจจุบัน: รายรับ ฿15,000.00 | รายจ่าย ฿5,000.00   (แสดงเมื่อตั้ง quotaResetAt)
รายจ่ายประจำ (Recurring ที่เปิดอยู่): ฿13,500.00/เดือน
รายรับประจำ (Recurring ที่เปิดอยู่): ฿50,000.00/เดือน
รายการ Recurring: [rec-1] Netflix Premium Ultra HD (รายจ่ายประจำ, ฿500.00, เปิด), ...
หมวดรายจ่ายที่มี (ยอดใช้ในรอบปัจจุบัน):
- [food] อาหาร & เครื่องดื่ม: ใช้ไป ฿1,500.00 (งบ ฿10,000.00)
...
หมวดรายรับที่มี: [salary] เงินเดือน & โบนัส, [investment] เงินปันผล & การลงทุน
```

---

### 2.3 Slip Vision Prompt (`buildSlipPrompt`)
อยู่ใน [src/lib/prompts.ts](file:///c:/Gitwork/Finora/src/lib/prompts.ts) ใช้สำหรับวิเคราะห์รูปสลิปโอนเงินธนาคาร / ใบเสร็จ e-Wallet โดยรับรูปที่ผ่าน `prepareSlipImage` (`<= 950KB` ส่งตรง หรือย่อไม่เกิน `1600px` เพื่อให้อยู่ใต้เพดาน `1 MB` ของ OCR.space) ร่วมกับข้อมูลเสริม 3 ส่วน:
1. **`ocrText`**: ข้อความภาษาไทยที่อ่านได้จาก OCR.space Engine 1 (`extractSlipOcrText` timeout `4s` + `cleanOcrText` ลบข้อความเตือน `[Note: ...]`) ส่งให้ Vision LLM ใช้ยืนยันตัวสะกดและตัวเลข
2. **`userName`**: ชื่อผู้ใช้เจ้าของบัญชีในระบบ (เช่น `"คุณธนภัทร วงศ์เจริญ"`) เพื่อใช้แยกแยะว่าผู้ใช้เป็น **ผู้โอน (`expense`)** หรือ **ผู้รับเงิน (`income`)**
3. **`categoryList`**: รายชื่อ `id` หมวดหมู่ที่มีในระบบ

**โครงสร้าง JSON ที่บังคับให้ Vision LLM ตอบกลับ:**
```json
{
  "isValidPaymentImage": true,
  "type": "expense",
  "sender": "นาย ธนภัทร วงศ์เจริญ",
  "receiver": "Potato shake & ข้าวหมูกรอบ",
  "merchant": "Potato shake & ข้าวหมูกรอบ",
  "promptPayId": "0812345678",
  "amount": 30,
  "categoryId": "food",
  "date": "2026-11-21"
}
```

### 2.4 การแปลงผลและตรวจจับผู้โอน/ผู้รับ (`parseSlipResult`)
อยู่ใน [src/lib/prompts.ts](file:///c:/Gitwork/Finora/src/lib/prompts.ts) ทำหน้าที่ Post-process JSON จาก Vision LLM:
- **ทำความสะอาดชื่อที่ถูกตัดคำ (`cleanSlipName`):** ลบ `...` หรือเศษพยัญชนะย่อท้ายบรรทัด เช่น `"นาย ชัยณรงค์ แ..."` → `"นาย ชัยณรงค์"`
- **ตรวจสอบชื่อผู้ใช้ (`namesLikelyMatch`):** ตัดคำนำหน้า (`คุณ`, `นาย`, `นางสาว`, `Mr.`, ฯลฯ) แล้วเทียบกับ `userName`:
  - ถ้า **`receiver` ตรงกับผู้ใช้** (และ `sender` เป็นคนอื่น) → บังคับตั้ง `type = "income"` และใช้ `merchant = sender`
  - ถ้า **`sender` ตรงกับผู้ใช้** → บังคับตั้ง `type = "expense"` และใช้ `merchant = receiver`
- **สกัดวันที่จากสลิป (`date`):** แปลงวันที่บนสลิป (ทั้ง พ.ศ. และ ค.ศ.) ด้วย `normalizeTransactionDate` และแนบ `date` เข้า Modal อัตโนมัติ (ถ้าไม่พบวันที่ชัดเจนจะใช้ `todayYmd()`, และถ้าสลิปเบลออ่านยอดไม่ได้จะเปิด Modal ให้กรอกยอดเองผ่าน `needsAmount`)
- **ป้องกันหมวดหมู่สงวน:** หาก LLM ตอบ `categoryId: "recurring"` หรือรหัสที่ไม่อยู่ในระบบ จะถูกแทนที่ด้วยค่าเริ่มต้น (`"food"` สำหรับรายจ่าย หรือ `"salary"` สำหรับรายรับ)

---

## 3. ส่วนที่ 2: สารานุกรม AI Tools ทั้ง 9 ตัว (`FINORA_TOOLS`)

แบ่งเป็น **Read Tools 5 ตัว** (`READ_TOOL_NAMES`) และ **Write Tools 4 ตัว** (`WRITE_TOOL_NAMES`) ใน [src/lib/ai-tools.ts](file:///c:/Gitwork/Finora/src/lib/ai-tools.ts)

### 3.1 Read Tools (5 ตัว — รันอัตโนมัติทันทีใน `runReadTool`)

| # | ชื่อ Tool | คำอธิบาย (Description) | พารามิเตอร์ (Parameters) | ข้อมูลที่ส่งกลับ (Return Payload) |
|---|---|---|---|---|
| 1 | **`get_financial_overview`** | ดูยอดเงิน Virtual Wallet คงเหลือ, รายรับรวม, รายจ่ายรวม, และยอดสุทธิปัจจุบัน | *(ไม่มี)* | `{ virtualBankBalance, totalIncome, totalExpense, netCashFlow, currentCycleIncome, currentCycleExpense, currentCycleNet, transactionCount }` |
| 2 | **`get_transactions`** | ดึงรายการธุรกรรมล่าสุด สามารถกรองตามประเภท หมวดหมู่ ช่วงวันที่ และรอบโควต้าได้ | - `type?`: `"all" \| "income" \| "expense"` (default `"all"`)<br>- `categoryId?`: `string` (รองรับ alias)<br>- `limit?`: `number` (1–30, default `10`)<br>- `startDate?` / `endDate?`: `YYYY-MM-DD` หรือ `DD/MM`<br>- `currentCycleOnly?`: `boolean` | `{ count, totalMatchedCount, totalMatchedAmount, transactions: [{ id, title, type, amount, category, channel, date }] }` |
| 3 | **`get_categories`** | ดูรายการหมวดหมู่ทั้งหมดพร้อมยอดใช้จริงเทียบกับงบประมาณรายเดือน (ไม่รวมหมวด `"recurring"`) | *(ไม่มี)* | `{ categories: [{ id, name, type, budget, spent, remainingBudget, overBudgetAmount, usagePercent }] }` *(กรอง `t.type === c.type` ในรอบโควต้าปัจจุบัน)* |
| 4 | **`get_recurring_payments`** | ดูรายการประจำ (Recurring) ทั้งรายจ่ายประจำและรายรับประจำ สถานะ และวันครบกำหนดถัดไป | *(ไม่มี)* | `{ currentBankBalance, activeMonthlyTotal, activeMonthlyIncomeTotal, monthlyNetRecurring, items: [{ id, title, amount, type, cycle, nextDueDate, active }] }` |
| 5 | **`get_financial_prediction`** | คำนวณคาดการณ์ยอดเงินและกระแสเงินสดในอนาคตล่วงหน้า พร้อมสมมติฐานและคำเตือนความเสี่ยง | - `monthsAhead?`: `number` (1–12 เดือน, default `3`) | `{ monthsAhead, currentBankBalance, baselineMonthlyIncome, baselineMonthlyOutflow, activeRecurringMonthly, activeRecurringIncomeMonthly, estimatedMonthlyNet, projectedBalance, lowBalanceRisk, assumptions: string[] }` *(ใช้ฐานจากรอบโควต้าปัจจุบันหรือย้อนหลัง 30 วันล่าสุด)* |

---

### 3.2 Write Tools (4 ตัว — ต้องผ่าน `validateAndNormalizeWriteTool` และรอผู้ใช้กดยืนยัน)

| # | ชื่อ Tool | รูปแบบ UI ยืนยัน | พารามิเตอร์ (Parameters) | กฎการตรวจสอบและแปลงค่า (`validateAndNormalizeWriteTool`) |
|---|---|---|---|---|
| 6 | **`add_transaction`** | **Blocking Modal** (รองรับทั้งใบเดียวและ **Batch หลายรายการในหน้าต่างเดียว**) | - `type` *(req)*: `"income" \| "expense"`<br>- `title` *(req)*: `string` (ชื่อรายการ/ร้านค้า)<br>- `amount` *(req)*: `number` (`> 0`)<br>- `categoryId` *(req)*: `string`<br>- `channel?`: `string` (default `"Virtual Bank Wallet"`)<br>- `date?`: `string` (`YYYY-MM-DD`, `DD/MM`, หรือคำสัมพัทธ์) | - `title` ต้องไม่ว่าง และปัด `amount` เป็นทศนิยม 2 ตำแหน่ง (`roundCurrency`, `> 0`)<br>- **ไม่บล็อกยอดเงินติดลบ** (อนุญาตให้ `bankBalance < 0`)<br>- แปลง `channel` อัตโนมัติ (`"cash"` → `"เงินสด"`, `"qr"` → `"สแกน PromptPay QR"`, `"card"` → `"Virtual Card"`)<br>- แปลง `date` ด้วย `normalizeTransactionDate` (ถ้าไม่ส่งมาใช้ `todayYmd()`, ถ้าส่งวันที่ผิดเช่น `"31/02"` คืน error)<br>- หาหมวดหมู่ด้วย `resolveCategory(rawCat, categories, txType, title)` (ถ้า `categoryId` ไม่ตรง จะ fallback เดาจาก `title`) |
| 7 | **`update_category_budget`** | **Inline Card** ในแชท | - `categoryId` *(req)*: `string`<br>- `budget` *(req)*: `number` (`>= 0`) | - ปัด `budget` เป็นทศนิยม 2 ตำแหน่ง (`roundCurrency`, `>= 0`)<br>- ต้องเป็นหมวดรายจ่าย (`type === "expense"`) ที่มีอยู่จริง และห้ามแก้ไขหมวด `"recurring"`<br>- แนบคำเตือน `⚠️` ใน `summary` หาก `budget` ต่ำกว่ายอดที่ใช้ไปแล้วในรอบปัจจุบัน |
| 8 | **`add_category`** | **Inline Card** ในแชท หรือ **Chained Blocking Modal** (เมื่อเรียกคู่กับ `add_transaction`) | - `name` *(req)*: `string`<br>- `type?`: `"expense" \| "income"` (default `"expense"`)<br>- `budget?`: `number` (`>= 0`, default `0`)<br>- `icon?`: enum `CATEGORY_ICON_IDS` (20 ไอคอน) | - ตัดช่องว่าง `name` และบล็อกชื่อสงวน `"recurring"` / `"รายจ่ายประจำ"`<br>- บล็อกชื่อซ้ำตรงเป๊ะภายในประเภทเดียวกัน (ถ้าซ้ำใน `expense` แนะให้ใช้ `update_category_budget`; อนุญาตหมวดย่อยและชื่อซ้ำข้ามประเภท)<br>- หมวดรายรับบังคับ `budget = 0`; หมวดรายจ่ายถ้าไม่ระบุให้ `budget = 0`<br>- เลือกสีอัตโนมัติด้วย `nextCategoryColor` (ไม่ซ้ำสีเดิม) และ fallback `icon` เป็น `"label"` / `"payments"` หากไม่ตรงชุดไอคอน |
| 9 | **`add_recurring_payment`** | **Inline Card** ในแชท | - `title` *(req)*: `string`<br>- `amount` *(req)*: `number` (`> 0`)<br>- `type?`: `"expense" \| "income"` (default `"expense"`)<br>- `categoryId?`: `string` (ใช้เมื่อ `type === "income"`)<br>- `cycle?`: `"monthly" \| "weekly" \| "yearly"` (default `"monthly"`)<br>- `nextDueDate?`: `string` (`YYYY-MM-DD` หรือ `DD/MM`, default วันที่ 1 ของเดือนถัดไป) | - ป้องกันชื่อรายการซ้ำ และปัด `amount` เป็นทศนิยม 2 ตำแหน่ง (`roundCurrency`)<br>- แปลง `nextDueDate` ด้วย `normalizeTransactionDate` (คืน error หากรูปแบบผิด, แนบคำเตือน `⚠️` หากเป็นวันในอดีต)<br>- ถ้ารายจ่ายประจำ (`expense`) บังคับ `categoryId = "recurring"` / `icon = "autorenew"`<br>- ถ้ารายรับประจำ (`income`) จับคู่หมวดรายรับด้วย `resolveCategory` (default `"salary"`, `icon = "payments"`) |

> *(หมายเหตุ: เครื่องมือ `toggle_recurring` ถูกนำออกใน v2.7.0 — การพัก/เปิดใช้งานหรือลบรายการประจำให้จัดการผ่านหน้า `/recurring`)*

---

## 4. ส่วนที่ 3: ระบบ Normalization, Fallback & Validation

### 4.1 การเดาและจับคู่หมวดหมู่ (`resolveCategory` & `CATEGORY_ALIASES`)
ฟังก์ชัน `resolveCategory(raw, categories, expectedType, fallbackText)` ใน [src/lib/ai-tools.ts](file:///c:/Gitwork/Finora/src/lib/ai-tools.ts#L189-L228) ทำงานตามลำดับดังนี้:
1. กรองหมวด `"recurring"` ออก และกรองเฉพาะหมวดที่ตรงกับ `expectedType` (`"expense"` หรือ `"income"`)
2. นำ `[raw, fallbackText]` (เช่น `[categoryId ที่ AI ส่งมา, title ชื่อรายการ]`) มาตรวจตามลำดับ:
   - **ขั้นที่ 1 (Exact ID):** ตรงกับ `category.id` เช่น `"food"`, `"transport"` (รวมถึง `draft-cat-*` ชั่วคราวเมื่อพ่วง `add_category`)
   - **ขั้นที่ 2 (Exact Name):** ตรงกับ `category.name` ที่ผู้ใช้สร้างไว้แบบตรงตัว (ตรวจก่อน alias เพื่อไม่ให้หมวดชื่ออย่าง `"กาแฟ"` ถูก alias พื้นฐานดึงไป `"food"`)
   - **ขั้นที่ 3 (Exact Alias):** ตรงกับคีย์ใน `CATEGORY_ALIASES`
   - **ขั้นที่ 4 (Category Name Substring):** ชื่อหมวดภาษาไทยมีคำนั้นอยู่
   - **ขั้นที่ 5 (Alias Substring):** มีคีย์เวิร์ดใน `CATEGORY_ALIASES` ผสมอยู่ในข้อความ (เช่น `title = "ค่ารถไฟฟ้า BTS"` เมื่อ `raw = "misc"` จะ fallback มาจับคู่คีย์เวิร์ด `"รถไฟฟ้า"` → `"transport"`)

**ตารางคีย์เวิร์ด `CATEGORY_ALIASES` (เรียง `transport` ก่อน `housing` เพื่อให้ `"รถไฟฟ้า"` จับคู่ `transport` ก่อน `"ไฟฟ้า"`):**

| หมวดหมู่ (`id`) | ประเภท | คีย์เวิร์ดที่รองรับ (ภาษาอังกฤษ & ภาษาไทย) |
|---|---|---|
| **`transport`** | `expense` | `transportation`, `travel`, `transit`, `commute`, `bts`, `mrt`, `grab`, `taxi`, `fuel`, `ptt`, `เดินทาง`, `น้ำมัน`, `รถไฟฟ้า`, `แท็กซี่`, `ทางด่วน`, `ปตท` |
| **`food`** | `expense` | `dining`, `drink`, `drinks`, `coffee`, `cafe`, `restaurant`, `starbucks`, `lunch`, `dinner`, `breakfast`, `meal`, `snack`, `grocery`, `groceries`, `อาหาร`, `เครื่องดื่ม`, `กาแฟ`, `ข้าว`, `ก๋วยเตี๋ยว`, `ขนม`, `ชานม`, `ชาเย็น`, `ชาเขียว`, `น้ำดื่ม` |
| **`shopping`** | `expense` | `shop`, `lifestyle`, `clothing`, `fashion`, `retail`, `ช้อปปิ้ง`, `เสื้อผ้า`, `รองเท้า`, `กระเป๋า`, `ของใช้`, `ซื้อของ` |
| **`housing`** | `expense` | `house`, `home`, `rent`, `bill`, `bills`, `utility`, `utilities`, `internet`, `electricity`, `บิล`, `ที่อยู่อาศัย`, `ค่าเช่า`, `ค่าไฟ`, `ค่าน้ำ`, `ค่าเน็ต`, `อินเทอร์เน็ต`, `คอนโด`, `หอพัก`, `ไฟฟ้า` |
| **`entertainment`** | `expense` | `movie`, `subscription`, `subscriptions`, `game`, `netflix`, `spotify`, `youtube`, `cinema`, `concert`, `บันเทิง`, `ดูหนัง`, `คอนเสิร์ต`, `เกม` |
| **`salary`** | `income` | `wage`, `bonus`, `income`, `freelance`, `payroll`, `เงินเดือน`, `โบนัส`, `ค่าจ้าง`, `ฟรีแลนซ์`, `รายได้` |
| **`investment`** | `income` | `invest`, `dividend`, `stock`, `interest`, `fund`, `ปันผล`, `ลงทุน`, `หุ้น`, `กองทุน`, `ดอกเบี้ย`, `กำไร` |

---

### 4.2 การแปลงรูปแบบวันที่ (`normalizeTransactionDate`)
อยู่ใน [src/lib/seed.ts](file:///c:/Gitwork/Finora/src/lib/seed.ts) รองรับวันที่ที่ AI หรือผู้ใช้ส่งมาหลากหลายรูปแบบ:
- **คำบอกวันที่สัมพัทธ์:** `"วันนี้"`, `"today"`, `"เมื่อวาน"`, `"เมื่อวานนี้"`, `"yesterday"`, `"เมื่อวานซืน"`, `"พรุ่งนี้"`, `"tomorrow"` (คำนวณเทียบจากวันที่ปัจจุบัน)
- **`YYYY-MM-DD` หรือ ISO Timestamp:** เช่น `"2026-08-15"`, `"2569-08-15"` (ถ้าปี `>= 2400` จะลบ `543` แปลง พ.ศ. → ค.ศ. อัตโนมัติ)
- **`DD/MM/YYYY` หรือ `DD-MM-YYYY`:** เช่น `"15/08/2026"`, `"15/08/2569"`, `"15/08/69"` (ปี 2 หลัก `>= 40` ตีความเป็น พ.ศ. `25xx`)
- **`DD/MM` หรือ `D/M`:** เช่น `"15/08"` → ใช้ปี ค.ศ. ปัจจุบันจาก `refDate` (`"2026-08-15"`)
- **การตรวจปฏิทินจริง:** ตรวจด้วย `new Date(year, month - 1, day)` เพื่อป้องกันวันที่ไม่มีอยู่จริง เช่น `"31/02"` หรือ `"31/04"`

---

### 4.3 ลำดับความสำคัญของการรัน Tools (`getToolExecutionPriority`)
เมื่อ LLM ส่งหลาย `tool_calls` พร้อมกันในรอบเดียว ระบบจะเรียงลำดับด้วย `getToolExecutionPriority` ([src/lib/ai-tools.ts](file:///c:/Gitwork/Finora/src/lib/ai-tools.ts)):
1. **Priority `0` (Read Tools ทั้ง 5 ตัว):** รันก่อนเสมอเพื่อให้ได้ข้อมูลล่าสุด
2. **Priority `1` (New Category):** `add_category` — รันก่อน `add_transaction` เพื่อให้หมวดร่าง (`draft-cat-*`) เข้าไปอยู่ใน `workingCategories` สำหรับการจับคู่ `categoryId`
3. **Priority `2` (Income / Credit):** `add_transaction` ที่เป็น `type: "income"`
4. **Priority `3` (Configuration Tools):** `update_category_budget`, `add_recurring_payment`
5. **Priority `4` (Expense / Debit):** `add_transaction` ที่เป็น `type: "expense"`

---

### 4.4 กลไกป้องกัน AI ลืมเรียก Tool, การวนลูป และ Error Resilience (`runToolLoop` & `callOpenRouter`)
อยู่ใน [src/app/(app)/ai-assistant/page.tsx](file:///c:/Gitwork/Finora/src/app/(app)/ai-assistant/page.tsx) และ [src/lib/openrouter.ts](file:///c:/Gitwork/Finora/src/lib/openrouter.ts):
1. **Auto-Retry เมื่อ AI พิมพ์จำลองว่าเรียก Tool (`looksLikeFakeToolConfirm`):**
   - หากในรอบแรก AI ตอบข้อความทำนองว่า `"กรุณากดยืนยันในการ์ด"` หรือ `"กำลังส่งรายการให้คุณยืนยัน"` แต่ไม่ได้ส่ง `tool_calls` มาจริง ระบบจะแนบข้อความ `[ระบบ] คุณยังไม่ได้ส่ง Function Call (tool_calls) จริง...` กลับไปให้ LLM เรียก Tool อัตโนมัติ 1 ครั้ง
2. **Batching & Chained Category + Transaction Modal:**
   - เมื่อ AI ส่ง `add_transaction` หลายรายการ หรือส่ง `add_category` พร้อม `add_transaction` ในรอบเดียวกัน `runToolLoop` จะจำลองหมวดใหม่ด้วย `draft-cat-*` ใน `workingCategories` แล้วรวบหมวดใหม่ + ทุกรายการเข้า **Chained Blocking Confirmation Modal** เดียว (สร้างหมวดหมู่ก่อนแล้วค่อยบันทึกรายการด้วย ID จริงแบบ atomic เมื่อผู้ใช้กดยืนยัน; หากเรียก `add_category` เดี่ยวจะแสดง Inline Card ปรับสี/ไอคอน/งบในแชทได้ทันที)
   - หลังกดยืนยัน **ไม่ยิงเรียก LLM ซ้ำ** จึงไม่เกิดการวนลูปซ้ำที่รายการแรก
3. **Malformed JSON / Unknown Tool Feedback & 4-Step Fallback:**
   - หาก `tc.function.arguments` เป็น JSON ที่พัง หรือ LLM เรียกชื่อ Tool ที่ไม่มีในระบบ (`else`) ระบบจะส่ง `role: "tool"` แจ้ง error กลับเข้า `history` เพื่อไม่ให้ลำดับ `tool_calls` เสียหาย และหากวนครบ 4 รอบแล้วยังไม่มีคำตอบจะแสดงข้อความแจ้งเตือนให้ผู้ใช้ทราบแทนการจบเงียบ
4. **OpenRouter Network Resilience (`callOpenRouter`):**
   - กำหนด Timeout `45 วินาที` (`AbortSignal.timeout`), อ่าน response ผ่าน `res.text()` ก่อน `JSON.parse` เพื่อกันหน้า HTML Error ทำแอปแครช, และทำ Auto-Retry สูงสุด 2 ครั้ง (หน่วง `1s`, `2s`) ทั้งกรณี HTTP `429`, `502`, `503`, `504` และ network error ชั่วคราว (ยกเว้น timeout ที่คืน error 504 ทันที)
