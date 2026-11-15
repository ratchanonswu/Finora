# Finora — AI-Powered Personal Finance Management Platform

Finora is a personal finance management web application built with **Next.js (App Router)**, **React**, **TypeScript**, and **Tailwind CSS**, featuring a **Dual Theme** (Light Fintech default + Emerald Nocturne Dark Mode), a **Virtual Bank Simulator API**, and **Google Gemini AI** integration.

---

## Project Structure

```text
Finora/
├── src/
│   ├── app/
│   │   ├── globals.css                 # Dual theme CSS variables (Light + Dark)
│   │   ├── layout.tsx                  # Root layout, fonts, FinoraProvider
│   │   ├── (auth)/                     # Authentication pages (no sidebar)
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── forgot-password/page.tsx
│   │   ├── (app)/                      # Main application pages (AppShell)
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                # Dashboard
│   │   │   ├── transactions/page.tsx   # Income & Expenses ledger
│   │   │   ├── recurring/page.tsx      # Recurring payments
│   │   │   ├── qr-scanner/page.tsx     # PromptPay QR scanner & payment
│   │   │   ├── categories/page.tsx     # Categories & monthly budgets
│   │   │   ├── virtual-bank/page.tsx   # Virtual Bank wallet & transfers
│   │   │   ├── ai-assistant/page.tsx   # Gemini AI Financial Advisor
│   │   │   └── settings/page.tsx       # Profile, theme, linked wallet, AI key
│   │   └── api/
│   │       ├── ai/chat/route.ts        # Google Gemini (@google/genai) endpoint
│   │       └── virtual-bank/route.ts   # Virtual Bank GET/POST service
│   ├── components/
│   │   ├── AppShell.tsx                # Sidebar, top bar, theme toggle
│   │   ├── AuthShell.tsx               # Split-screen auth layout
│   │   └── TransactionModal.tsx        # Global add-transaction modal
│   ├── context/
│   │   └── FinoraContext.tsx           # Client state + localStorage persistence
│   └── lib/
│       ├── types.ts                    # Shared TypeScript interfaces
│       ├── seed.ts                     # Initial data & THB/date formatters
│       ├── bank-service.ts             # Pure Virtual Bank transfer logic
│       └── self-check.ts               # Assert-based self-check for bank logic
├── prototypes/                         # Cleaned static HTML design blueprints
├── emerald_nocturne/                   # Dark theme design specification
├── Objective.md                        # Product & architecture specification
├── .env.example                        # Environment variable template
└── package.json
```

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Gemini API Key
Copy `.env.example` to `.env.local` and set your Gemini API key:
```bash
cp .env.example .env.local
```
```env
GEMINI_API_KEY=your_gemini_api_key_here
```
*(Alternatively, you can enter a Gemini API key override directly in **Settings** inside the app.)*

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Verify & Build
```bash
npm run test:check   # Runs bank-service assertions
npm run build        # Production TypeScript & Next.js build
```
