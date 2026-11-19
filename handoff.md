# Session Handoff: Finora Feature Additions, AI Confirmation & Recurring Settlement

## 1. Context & Objective
- **Current Goal:** Completed all requested refinements across transactions, AI Assistant, auth/storage isolation, categories, and recurring payments so the user can pull and continue seamlessly on another machine:
  1. Added `"เงินสด"` payment channel option in manual & AI transaction flows, configured to debit/credit Virtual Bank just like other channels (`autoDebitOnExpense`).
  2. Scoped AI chat `sessionStorage` cache per user email and blocked duplicate-email registration.
  3. Added GFM Markdown table rendering in the AI Assistant chat stream.
  4. Improved AI write-tool error handling (`!res.ok`, network `catch`) and added a channel selector to `add_transaction` confirmation cards.
  5. Required explicit user confirmation before booking QR / slip transactions (`"pending"` / `"cancelled"` states).
  6. Separated Recurring items into a dedicated `"recurring"` category (`รายจ่ายประจำ (Recurring)`) with auto-synced budget and added per-item + bulk settlement buttons on `/recurring`.
- **Active Branch:** `main` (at `d6a2539` prior to this handoff doc commit).
- **Workspace State:** Clean before updating `handoff.md`.

## 2. Key Decisions & Architecture
- **Cash (`"เงินสด"`) Deducts/Credits Virtual Bank:** Kept `"เงินสด"` as a selectable channel in `TransactionModal.tsx` and the AI confirmation card, while keeping Virtual Bank debit/credit (`autoDebitOnExpense`) and overdraft validation active for all channels including `"เงินสด"` (reversal of initial cash-bypass decision per user's lightweight tracker objective).
- **Per-User AI Chat Session Cache:** Replaced global `finora_chat_session_v1` with `finora_chat_session_v1:<normalized_email>`. `logoutUser()` resets in-memory `chatMessages` while keeping that user's `sessionStorage` entry for same-tab re-login; `loginUser()` loads it; `registerUser()` clears it; mount removes legacy un-scoped `finora_chat_session_v1`.
- **Duplicate Email Guard on Register:** `register/page.tsx` rejects emails matching `INITIAL_USER.email` or the stored `user.email`.
- **Zero-Dependency Markdown Table Parser:** Extended `renderChatMarkdown` in `ai-assistant/page.tsx` with `splitTableRow`, `parseTableSeparator`, and `tableAlignClass` supporting alignments (`:---`, `:---:`, `---:`) and inline formatting (`**bold**`, `` `code` ``).
- **QR / Slip Confirmation Before Booking:** `handleQrOrSlipFile` always creates a `"pending"` (when amount > 0) or `"needs_amount"` `ChatTxAction` card with editable merchant, type, category, and amount rather than auto-booking immediately.
- **Tool Execution Error Handling:** `handleConfirmTool` leaves cards in `"pending"` and appends a `role: "error"` message when `addTransaction` or `executeBankAction` fails (`!res.ok`), and catches network exceptions from chained `runToolLoop` calls.
- **Dedicated `"recurring"` Category & Settlement Actions:**
  - Added base expense category `id: "recurring"` (`รายจ่ายประจำ (Recurring)`, `#0D9488`) in `seed.ts`.
  - All recurring items map to `categoryId: "recurring"`; its monthly budget is auto-computed via `computeRecurringMonthlyBudget(recurring)` (`syncCategoriesWithRecurring` in `FinoraContext.tsx`) and locked in `/categories` and `update_category_budget`.
  - `payRecurringItem(id)` debits 1 item, records 1 transaction in `"recurring"`, and advances its `nextDueDate`.
  - `payAllActiveRecurring()` debits the sum of all active recurring items as **1 combined transaction** (`ชำระรายจ่ายประจำรวม (N รายการ)`) and advances `nextDueDate` for all active items.

## 3. Current State & Files Touched
- [src/lib/types.ts](file:///d:/526/Finora/src/lib/types.ts) (`f2d3a77`): Added `"pending"` and `"cancelled"` to `ChatTxAction.status`.
- [src/lib/seed.ts](file:///d:/526/Finora/src/lib/seed.ts) (`9c590a7`): Added `"recurring"` base category, `computeRecurringMonthlyBudget`, and updated seed recurring/transaction category references.
- [src/lib/ai-tools.ts](file:///d:/526/Finora/src/lib/ai-tools.ts) (`4ba4762`, `020109b`, `9c590a7`): Updated `add_transaction` channel schema and overdraft validation (applies to `"เงินสด"` too); forced `add_recurring_payment` to `categoryId: "recurring"` and blocked `update_category_budget` for `"recurring"`.
- [src/lib/self-check.ts](file:///d:/526/Finora/src/lib/self-check.ts) (`4ba4762`, `020109b`): Added assertions for `"cash"` channel normalization and overdraft rejection.
- [src/context/FinoraContext.tsx](file:///d:/526/Finora/src/context/FinoraContext.tsx) (`2c3ac4b`, `d59382e`, `020109b`, `9c590a7`, `d6a2539`): Scoped AI chat `sessionStorage` per user; unified `"เงินสด"` with Virtual Bank debit/credit; added `syncCategoriesWithRecurring`, `payRecurringItem`, and `payAllActiveRecurring`.
- [src/components/TransactionModal.tsx](file:///d:/526/Finora/src/components/TransactionModal.tsx) (`2c3ac4b`, `020109b`): Added `"เงินสด"` option to the manual transaction channel selector.
- [src/app/(auth)/register/page.tsx](file:///d:/526/Finora/src/app/(auth)/register/page.tsx) (`ccab419`): Blocked registering with already-used email (`INITIAL_USER.email` or `user.email`).
- [src/app/(app)/categories/page.tsx](file:///d:/526/Finora/src/app/(app)/categories/page.tsx) (`9c590a7`): Locked budget editing for the `"recurring"` category with an auto-calculated badge.
- [src/app/(app)/recurring/page.tsx](file:///d:/526/Finora/src/app/(app)/recurring/page.tsx) (`d6a2539`): Removed category dropdown from form; added **"ตัดยอดทั้งหมด"** and per-item **"ตัดยอดรายการนี้"** buttons with feedback banner.
- [src/app/(app)/ai-assistant/page.tsx](file:///d:/526/Finora/src/app/(app)/ai-assistant/page.tsx) (`044cf2c`, `746524b`, `f2d3a77`, `d6a2539`): Added Markdown table rendering, `handleConfirmTool` error handling, channel selector on `add_transaction` cards, QR/slip confirmation cards, and removed `"recurring"` / category selects from `update_category_budget` & `add_recurring_payment` cards.
- **Verification Status (after latest code commit `d6a2539`):**
  - `npm run test:check`: Passed (`11/11 checks`).
  - `npx tsc --noEmit`: Passed (0 errors).
  - `npm run build`: Passed (all 16 routes compiled).
  - `npm run lint`: Not configured (`next lint` prompts for interactive ESLint setup).

## 4. Failed Attempts & Dead Ends (DO NOT REPEAT)
- **Windows Sandbox `npm run build` (`EPERM: mkdir`):** Initial `npm run build` runs in the Windows sandbox can fail transiently with `EPERM: operation not permitted, mkdir 'D:\526\Finora\.next\...'`. Re-running `npm run build` succeeds.
- **PowerShell Unquoted `(auth)` / `(app)` Paths in `git add`:** PowerShell parses `(auth)` or `(app)` as subexpressions unless quoted; always quote paths like `'src/app/(app)/recurring/page.tsx'`.
- **Git Identity on Commit:** If `git commit` fails with `Author identity unknown`, pass `-c user.name="ratchanonswu" -c user.email="worlddestroyyerbeta@gmail.com"`.
- **Post-`executeBankAction` State Merge:** Inside `FinoraContext.tsx`, `payRecurringItem` and `payAllActiveRecurring` must call `setState((prev) => ...)` *after* `await executeBankAction(...)` so they don't overwrite the updated `bankBalance` and `ledger` from `executeBankAction`.

## 5. Immediate Next Steps
1. On the target machine, pull `main` (ensure this `handoff.md` commit is pushed first if pulling via remote) and run `npm install` (if dependencies aren't cached) + `npm run dev`.
2. Smoke-test the updated end-to-end flows in the browser:
   - Manual & AI `"เงินสด"` transactions debiting/crediting Virtual Bank.
   - QR / slip upload pausing for user confirmation before booking.
   - `/recurring` single-item **"ตัดยอดรายการนี้"** and batch **"ตัดยอดทั้งหมด"** updating Virtual Bank, Transactions, `nextDueDate`, and `/categories` `"รายจ่ายประจำ (Recurring)"` spent/budget gauges.
3. Optional: Configure ESLint (`eslint.config.*`) if `npm run lint` is required later.

## 6. Recommended Skills & Tools
- `ponytail` — Keep edits minimal and avoid premature abstractions.
- `grill-me` — Use when clarifying product or state-transition edge cases before coding.
