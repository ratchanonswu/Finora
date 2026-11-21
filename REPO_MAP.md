# 🗺️ Repo Map: Finora

> Path: `C:\Gitwork\Finora`

```text
  📄 MAP.md (164 lines)
  📄 Objective.md (449 lines)
  📄 README.md (80 lines)
  📄 next-env.d.ts (6 lines)
  📄 next.config.ts (9 lines)
  📄 package.json (27 lines)
  📄 postcss.config.mjs (8 lines)
  📄 tailwind.config.ts (52 lines)
  📄 tsconfig.json (24 lines)
  📁 emerald_nocturne/
    📄 DESIGN.md (258 lines)
  📁 prototypes/
    📁 finora/
      📄 code.html (624 lines)
    📁 finora_ai_ai_assistant/
      📄 code.html (367 lines)
    📁 finora_categories/
      📄 code.html (662 lines)
    📁 finora_forgot_password/
      📄 code.html (321 lines)
    📁 finora_login/
      📄 code.html (350 lines)
    📁 finora_qr_code_qr_scanner/
      📄 code.html (413 lines)
    📁 finora_recurring_payments/
      📄 code.html (973 lines)
    📁 finora_register/
      📄 code.html (431 lines)
    📁 finora_settings/
      📄 code.html (574 lines)
    📁 finora_transactions/
      📄 code.html (1021 lines)
    📁 finora_virtual_bank/
      📄 code.html (603 lines)
  📁 src/
    📁 app/
      📄 globals.css (196 lines)
      📄 layout.tsx (35 lines)
         ├─ component RootLayout (L11)
      📁 (app)/
        📄 layout.tsx (6 lines)
           ├─ component AppLayout (L4)
        📄 page.tsx (398 lines)
           ├─ component DashboardPage (L31)
        📁 ai-assistant/
          📄 page.tsx (2262 lines)
             ├─ component AiAssistantPage (L251)
        📁 categories/
          📄 page.tsx (228 lines)
             ├─ component CategoriesPage (L8)
        📁 recurring/
          📄 page.tsx (440 lines)
             ├─ component RecurringPage (L8)
        📁 settings/
          📄 page.tsx (341 lines)
             ├─ component SettingsPage (L30)
        📁 transactions/
          📄 page.tsx (219 lines)
             ├─ component TransactionsPage (L7)
        📁 virtual-bank/
          📄 page.tsx (275 lines)
             ├─ component VirtualBankPage (L7)
      📁 (auth)/
        📁 forgot-password/
          📄 page.tsx (157 lines)
             ├─ component ForgotPasswordPage (L25)
        📁 login/
          📄 page.tsx (182 lines)
             ├─ component LoginPage (L26)
        📁 register/
          📄 page.tsx (233 lines)
             ├─ component RegisterPage (L27)
      📁 api/
        📁 ai/
          📁 chat/
            📄 route.ts (41 lines)
               ├─ fn POST (L6)
          📁 qr/
            📄 route.ts (70 lines)
               ├─ fn POST (L6)
        📁 virtual-bank/
          📄 route.ts (50 lines)
             ├─ fn GET (L12)
             ├─ fn POST (L21)
    📁 components/
      📄 AppShell.tsx (301 lines)
         ├─ component AppShell (L25)
      📄 AuthShell.tsx (120 lines)
         ├─ component AuthShell (L16)
      📄 IconColorPicker.tsx (184 lines)
         ├─ component IconColorPicker (L53)
      📄 TransactionModal.tsx (225 lines)
         ├─ component TransactionModal (L8)
    📁 context/
      📄 FinoraContext.tsx (712 lines)
         ├─ component FinoraProvider (L160)
         ├─ component useFinora (L708)
    📁 lib/
      📄 ai-tools.ts (709 lines)
         ├─ interface FinancialSnapshot (L5)
         ├─ fn getToolExecutionPriority (L30)
         ├─ fn resolveCategory (L160)
         ├─ fn resolveRecurring (L197)
         ├─ fn runReadTool (L395)
         ├─ fn describeWriteTool (L504)
         ├─ fn validateAndNormalizeWriteTool (L544)
      📄 bank-service.ts (45 lines)
         ├─ interface BankTransferRequest (L4)
         ├─ interface BankTransferResult (L12)
         ├─ fn executeBankTransfer (L20)
      📄 ocr.ts (75 lines)
         ├─ fn extractSlipOcrText (L6)
      📄 openrouter.ts (130 lines)
         ├─ type OpenRouterContent (L1)
         ├─ interface OpenRouterToolCall (L8)
         ├─ interface OpenRouterMessage (L17)
         ├─ interface OpenRouterToolDef (L24)
         ├─ interface LLMMetrics (L33)
         ├─ fn callOpenRouter (L41)
      📄 prompts.ts (187 lines)
         ├─ interface QrSlipAnalysisResult (L5)
         ├─ fn buildFinoraSystemPrompt (L16)
         ├─ fn buildQrSlipPrompt (L54)
         ├─ fn parseQrSlipResult (L122)
      📄 qr-decoder.ts (137 lines)
         ├─ fn decodeQrImage (L7)
      📄 rollover.ts (223 lines)
         ├─ interface MonthlyRolloverResult (L4)
         ├─ interface RolloverInput (L14)
         ├─ interface RolloverOutput (L22)
         ├─ fn simulateRolloverToDate (L68)
      📄 seed.ts (291 lines)
         ├─ fn relativeDateYmd (L17)
         ├─ fn computeRecurringMonthlyBudget (L42)
         ├─ fn isBaseCategory (L52)
         ├─ fn nextCategoryColor (L59)
         ├─ fn isInCurrentQuotaCycle (L152)
         ├─ fn advanceDueDate (L157)
         ├─ fn todayYmd (L170)
         ├─ fn ymdToIso (L174)
         ├─ fn toDateInputValue (L179)
         ├─ fn normalizeTransactionDate (L202)
         ├─ fn formatTHB (L228)
         ├─ fn formatThaiDate (L236)
         └─ fn parsePromptPayPayload (L247)
      📄 self-check.ts (295 lines)
      📄 types.ts (102 lines)
         ├─ type ThemeMode (L1)
         ├─ type TransactionType (L3)
         ├─ interface Category (L5)
         ├─ interface Transaction (L14)
         ├─ interface RecurringPayment (L27)
         ├─ interface BankLedgerEntry (L40)
         ├─ interface UserProfile (L51)
         ├─ interface AppSettings (L58)
         ├─ interface ChatTxAction (L73)
         ├─ interface PendingToolCall (L86)
         └─ interface ChatMessage (L95)
  📁 tests/
    📁 llm/
      📄 eval-cases.json (117 lines)
      📄 qr_scan_eval.ipynb (1017 lines)
```
