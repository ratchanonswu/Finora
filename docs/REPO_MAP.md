# 🗺️ Repo Map: Finora

> Path: `C:\Gitwork\Finora`

```text
  📄 README.md (102 lines)
  📄 next-env.d.ts (6 lines)
  📄 next.config.ts (9 lines)
  📄 package.json (26 lines)
  📄 postcss.config.mjs (8 lines)
  📄 tailwind.config.ts (52 lines)
  📄 tsconfig.json (24 lines)
  📄 tsconfig.tsbuildinfo (1 lines)
  📁 docs/
    📄 AI_TOOLS_AND_PROMPTS.md (251 lines)
    📄 MAP.md (175 lines)
    📄 Objective.md (449 lines)
    📄 REPO_MAP.md (193 lines)
    📄 handoff.md (60 lines)
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
        📄 page.tsx (313 lines)
           ├─ component DashboardPage (L35)
        📁 ai-assistant/
          📄 page.tsx (2750 lines)
             ├─ component AiAssistantPage (L263)
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
          📁 slip/
            📄 route.ts (70 lines)
               ├─ fn POST (L6)
        📁 virtual-bank/
          📄 route.ts (50 lines)
             ├─ fn GET (L12)
             ├─ fn POST (L21)
    📁 components/
      📄 AppShell.tsx (240 lines)
         ├─ component AppShell (L26)
      📄 AuthShell.tsx (120 lines)
         ├─ component AuthShell (L16)
      📄 IconColorPicker.tsx (184 lines)
         ├─ component IconColorPicker (L53)
      📄 TransactionModal.tsx (225 lines)
         ├─ component TransactionModal (L8)
      📁 dashboard/
        📄 AiInsightsCard.tsx (63 lines)
           ├─ component AiInsightsCard (L7)
        📄 BudgetOverviewCard.tsx (113 lines)
           ├─ component BudgetOverviewCard (L8)
        📄 DashboardShell.tsx (226 lines)
           ├─ component DashboardHeader (L8)
        📄 ExpenseBreakdownCard.tsx (189 lines)
           ├─ component ExpenseBreakdownCard (L17)
        📄 IncomeExpenseChart.tsx (296 lines)
           ├─ component IncomeExpenseChart (L23)
        📄 RecentTransactionsCard.tsx (103 lines)
           ├─ component RecentTransactionsCard (L8)
        📄 SummaryCards.tsx (351 lines)
           ├─ component SummaryCards (L112)
        📄 dashboard-utils.ts (744 lines)
           ├─ type DatePreset (L4)
           ├─ type ChartGranularity (L12)
           ├─ interface DateRange (L14)
           ├─ interface PeriodSummary (L22)
           ├─ interface SparklineSeries (L38)
           ├─ interface BarBucket (L44)
           ├─ interface BudgetCategoryItem (L53)
           ├─ interface BudgetOverviewSummary (L65)
           └─ ... (18 more symbols)
    📁 context/
      📄 FinoraContext.tsx (731 lines)
         ├─ component FinoraProvider (L161)
         ├─ component useFinora (L727)
    📁 lib/
      📄 ai-tools.ts (928 lines)
         ├─ interface FinancialSnapshot (L14)
         ├─ fn getToolExecutionPriority (L62)
         ├─ fn resolveCategory (L189)
         ├─ fn runReadTool (L441)
         ├─ fn describeWriteTool (L628)
         ├─ fn validateAndNormalizeWriteTool (L691)
      📄 bank-service.ts (45 lines)
         ├─ interface BankTransferRequest (L4)
         ├─ interface BankTransferResult (L12)
         ├─ fn executeBankTransfer (L20)
      📄 ocr.ts (84 lines)
         ├─ fn cleanOcrText (L6)
         ├─ fn extractSlipOcrText (L16)
      📄 openrouter.ts (180 lines)
         ├─ type OpenRouterContent (L1)
         ├─ interface OpenRouterToolCall (L8)
         ├─ interface OpenRouterMessage (L17)
         ├─ interface OpenRouterToolDef (L24)
         ├─ interface LLMMetrics (L33)
         ├─ fn callOpenRouter (L49)
      📄 prompts.ts (193 lines)
         ├─ interface SlipAnalysisResult (L6)
         ├─ fn buildFinoraSystemPrompt (L18)
         ├─ fn buildSlipPrompt (L59)
         ├─ fn parseSlipResult (L125)
      📄 rollover.ts (223 lines)
         ├─ interface MonthlyRolloverResult (L4)
         ├─ interface RolloverInput (L14)
         ├─ interface RolloverOutput (L22)
         ├─ fn simulateRolloverToDate (L68)
      📄 seed.ts (277 lines)
         ├─ fn relativeDateYmd (L17)
         ├─ fn computeRecurringMonthlyBudget (L42)
         ├─ fn isBaseCategory (L52)
         ├─ fn nextCategoryColor (L59)
         ├─ fn isInCurrentQuotaCycle (L152)
         ├─ fn advanceDueDate (L169)
         ├─ fn todayYmd (L182)
         ├─ fn ymdToIso (L186)
         └─ ... (5 more symbols)
      📄 self-check.ts (673 lines)
      📄 slip-image.ts (74 lines)
         ├─ fn prepareSlipImage (L7)
      📄 types.ts (102 lines)
         ├─ type ThemeMode (L1)
         ├─ type TransactionType (L3)
         ├─ interface Category (L5)
         ├─ interface Transaction (L14)
         ├─ interface RecurringPayment (L27)
         ├─ interface BankLedgerEntry (L40)
         ├─ interface UserProfile (L51)
         ├─ interface AppSettings (L58)
         └─ ... (3 more symbols)
  📁 tests/
    📁 llm/
      📄 eval-cases.json (117 lines)
      📄 qr_scan_eval.ipynb (1017 lines)
      📁 samples/
```
