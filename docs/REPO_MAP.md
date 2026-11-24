# 🗺️ Repo Map: Finora

> Path: `C:\Gitwork\Finora`

```text
  📄 README.md (156 lines)
  📄 next-env.d.ts (6 lines)
  📄 next.config.ts (9 lines)
  📄 package.json (26 lines)
  📄 postcss.config.mjs (8 lines)
  📄 tailwind.config.ts (52 lines)
  📄 tsconfig.json (24 lines)
  📄 tsconfig.tsbuildinfo (1 lines)
  📁 docs/
    📄 AI_TOOLS_AND_PROMPTS.md (267 lines)
    📄 MAP.md (184 lines)
    📄 Objective.md (449 lines)
    📄 REPO_MAP.md (173 lines)
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
        📄 page.tsx (345 lines)
           ├─ component DashboardPage (L35)
        📁 ai-assistant/
          📄 page.tsx (3138 lines)
             ├─ component AiAssistantPage (L286)
        📁 categories/
          📄 page.tsx (407 lines)
        📁 recurring/
          📄 page.tsx (501 lines)
        📁 settings/
          📄 page.tsx (401 lines)
        📁 transactions/
          📄 page.tsx (480 lines)
        📁 virtual-bank/
          📄 page.tsx (304 lines)
      📁 (auth)/
        📁 forgot-password/
          📄 page.tsx (160 lines)
        📁 login/
          📄 page.tsx (186 lines)
        📁 register/
          📄 page.tsx (305 lines)
      📁 api/
        📁 ai/
          📁 chat/
            📄 route.ts (44 lines)
          📁 slip/
            📄 route.ts (74 lines)
        📁 virtual-bank/
          📄 route.ts (50 lines)
    📁 components/
      📄 AppShell.tsx (259 lines)
         ├─ component AppShell (L26)
      📄 AuthShell.tsx (120 lines)
      📄 ConfirmDialog.tsx (102 lines)
         ├─ component ConfirmDialog (L20)
      📄 IconColorPicker.tsx (190 lines)
      📄 TransactionModal.tsx (293 lines)
      📁 dashboard/
        📄 AiInsightsCard.tsx (65 lines)
        📄 BudgetOverviewCard.tsx (113 lines)
        📄 DashboardShell.tsx (281 lines)
           ├─ component DashboardHeader (L32)
        📄 ExpenseBreakdownCard.tsx (207 lines)
        📄 IncomeExpenseChart.tsx (305 lines)
        📄 RecentTransactionsCard.tsx (103 lines)
        📄 SummaryCards.tsx (370 lines)
           ├─ component SummaryCards (L113)
        📄 dashboard-utils.ts (779 lines)
    📁 context/
      📄 FinoraContext.tsx (809 lines)
         ├─ component FinoraProvider (L168)
         ├─ component useFinora (L805)
    📁 lib/
      📄 ai-handoff.ts (39 lines)
         ├─ fn buildDashboardInsightPrompt (L7)
         ├─ fn queueAiInsightPrompt (L14)
         ├─ fn consumeAiInsightPrompt (L27)
      📄 ai-tools.ts (1088 lines)
         ├─ interface FinancialSnapshot (L15)
         ├─ fn getToolExecutionPriority (L64)
         ├─ fn resolveCategory (L191)
         ├─ fn runReadTool (L481)
         ├─ fn describeWriteTool (L788)
         ├─ fn validateAndNormalizeWriteTool (L851)
      📄 bank-service.ts (45 lines)
         ├─ interface BankTransferRequest (L4)
         ├─ interface BankTransferResult (L12)
         ├─ fn executeBankTransfer (L20)
      📄 financial-insights.ts (533 lines)
         ├─ interface FinancialInsightsInput (L9)
         ├─ interface CategoryInsight (L26)
         ├─ interface SavingsOpportunityItem (L49)
         ├─ interface FinancialInsightsResult (L59)
         ├─ fn toMonthlyRecurringAmount (L117)
         ├─ fn computeFinancialInsights (L229)
         ├─ fn formatCompactInsightsForPrompt (L489)
      📄 ocr.ts (84 lines)
         ├─ fn cleanOcrText (L6)
         ├─ fn extractSlipOcrText (L16)
      📄 openrouter.ts (202 lines)
         ├─ type OpenRouterContent (L1)
         ├─ interface OpenRouterToolCall (L8)
         ├─ interface OpenRouterMessage (L17)
         ├─ interface OpenRouterToolDef (L24)
         ├─ interface LLMMetrics (L33)
         ├─ fn callOpenRouter (L49)
      📄 prompts.ts (210 lines)
         ├─ interface SlipAnalysisResult (L6)
         ├─ fn buildFinoraSystemPrompt (L18)
         ├─ fn buildSlipPrompt (L76)
         ├─ fn parseSlipResult (L142)
      📄 rollover.ts (223 lines)
         ├─ interface MonthlyRolloverResult (L4)
         ├─ interface RolloverInput (L14)
         ├─ interface RolloverOutput (L22)
         ├─ fn simulateRolloverToDate (L68)
      📄 seed.ts (397 lines)
         ├─ fn relativeDateYmd (L17)
         ├─ fn computeRecurringMonthlyBudget (L55)
         ├─ fn isBaseCategory (L65)
         ├─ fn nextCategoryColor (L72)
         ├─ fn isInCurrentQuotaCycle (L193)
         ├─ fn advanceDueDate (L210)
         ├─ fn todayYmd (L223)
         ├─ fn ymdToIso (L227)
         ├─ fn formatTHB (L303)
         ├─ fn matchesTransactionDateQuery (L320)
         └─ ... (more helpers)
      📄 self-check.ts (838 lines)
      📄 slip-image.ts (74 lines)
         ├─ fn prepareSlipImage (L7)
      📄 types.ts (102 lines)
      📄 useDialogAccessibility.ts (91 lines)
         ├─ fn useDialogAccessibility (L18)
  📁 tests/
    📁 llm/
      📄 eval-cases.json (184 lines)
      📄 qr_scan_eval.ipynb (1017 lines)
      📁 samples/
```
