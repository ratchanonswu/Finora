<div align="center">

# Finora 

**AI-Powered Personal Finance Management Platform**

![Next.js 15](https://img.shields.io/badge/Next.js-15_(App_Router)-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-Styling-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![OpenRouter](https://img.shields.io/badge/OpenRouter-LLM_%26_Vision-6366F1?style=flat-square)
![OCR.space](https://img.shields.io/badge/OCR.space-Thai_Slip_Scanner-059669?style=flat-square)

[Overview](#overview) · [Documentation](#documentation) · [Project Structure](#project-structure) · [Getting Started](#getting-started) · [Verify & Build](#4-verify--build)

</div>

---

## Overview

Finora is a personal finance management web application built with **Next.js 15 (App Router)**, **React 19**, **TypeScript**, and **Tailwind CSS**, featuring a **Dual Theme** (Light Fintech default + Emerald Nocturne Dark Mode), a **Virtual Bank Simulator API**, and **OpenRouter LLM / Vision + OCR.space Thai Slip Scanner** integration.

| Pillar | Details |
| :--- | :--- |
| **Core Stack** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS |
| **Theming** | Dual Theme — Light Fintech (default) and Emerald Nocturne Dark Mode |
| **Banking Simulation** | Virtual Bank Simulator API (`GET` / `POST`) |
| **AI & Slip Scanning** | OpenRouter LLM / Vision + OCR.space Thai Slip Scanner |

---

## Documentation

All architecture blueprints, symbol references, AI handbooks, and product specifications live in [`docs/`](docs/).

| Document | Description |
| :--- | :--- |
| [`docs/MAP.md`](docs/MAP.md) | System Architecture, Module Responsibilities, & Data Flow Blueprint |
| [`docs/REPO_MAP.md`](docs/REPO_MAP.md) | File & Symbol Dictionary |
| [`docs/AI_TOOLS_AND_PROMPTS.md`](docs/AI_TOOLS_AND_PROMPTS.md) | AI Tools (10 Tools) & Prompts (`v2.10.0`) Handbook |
| [`docs/Objective.md`](docs/Objective.md) | Original Product & UX Specification |

---

## Project Structure

```text
Finora/
├── docs/
│   ├── MAP.md                          # Architecture & data flow blueprint
│   ├── REPO_MAP.md                     # File & exported symbol dictionary
│   ├── AI_TOOLS_AND_PROMPTS.md         # AI tools, prompts & validation handbook
│   └── Objective.md                    # Original product & UX specification
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
│   │   │   ├── page.tsx                # Modular Dashboard
│   │   │   ├── transactions/page.tsx   # Income & Expenses ledger
│   │   │   ├── recurring/page.tsx      # Recurring payments & income
│   │   │   ├── categories/page.tsx     # Categories & monthly budgets
│   │   │   ├── virtual-bank/page.tsx   # Virtual Bank wallet & transfers
│   │   │   ├── ai-assistant/page.tsx   # Finora AI Chat & Slip Auto-Scanner
│   │   │   └── settings/page.tsx       # Profile, theme, rollover, AI key
│   │   └── api/
│   │       ├── ai/chat/route.ts        # OpenRouter AI chat & tool-calling endpoint
│   │       ├── ai/slip/route.ts        # OCR.space + Vision LLM slip scanner endpoint
│   │       └── virtual-bank/route.ts   # Virtual Bank GET/POST service
│   ├── components/
│   │   ├── dashboard/                  # DashboardHeader & modular Dashboard widgets
│   │   ├── AppShell.tsx                # Unified sidebar + DashboardHeader topbar
│   │   ├── AuthShell.tsx               # Split-screen auth layout
│   │   ├── ConfirmDialog.tsx           # Reusable accessible confirmation dialog
│   │   ├── IconColorPicker.tsx         # Shared category icon & color picker
│   │   └── TransactionModal.tsx        # Global add-transaction modal
│   ├── context/
│   │   └── FinoraContext.tsx           # Client state + localStorage/sessionStorage persistence
│   └── lib/
│       ├── ai-handoff.ts               # One-shot Dashboard AI Insights -> chat handoff
│       ├── ai-tools.ts                 # 10 AI tool schemas, resolvers & validators
│       ├── bank-service.ts             # Pure Virtual Bank transfer logic
│       ├── financial-insights.ts       # Pure MoM, burn-pace, safe-spend & savings engine
│       ├── ocr.ts                      # OCR.space Thai slip text helper (4s timeout)
│       ├── openrouter.ts               # OpenRouter HTTP client with timeout & retry
│       ├── prompts.ts                  # System & slip vision prompts (v2.10.0) + parser
│       ├── rollover.ts                 # Date-driven monthly rollover simulator
│       ├── seed.ts                     # 3-month initial data, formatters, date & quota helpers
│       ├── slip-image.ts               # Client slip resize/compression (<= 950KB / 1600px)
│       ├── types.ts                    # Shared TypeScript interfaces
│       ├── useDialogAccessibility.ts   # Modal Escape, focus-trap & scroll-lock hook
│       └── self-check.ts               # Automated self-check assertions (30 checks)
├── prototypes/                         # Static HTML design blueprints
├── emerald_nocturne/                   # Dark theme design specification
├── .env.example                        # Environment variable template
└── package.json
```

---

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure OpenRouter API Key & Model

Copy `.env.example` to `.env.local` and set your OpenRouter API key and vision-capable model (plus optional OCR.space key for faster/dedicated Thai slip OCR):

```bash
cp .env.example .env.local
```

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=nvidia/nemotron-3.5-super-vl:free
# OCR_SPACE_API_KEY=your_ocr_space_api_key_here
```

| Variable | Required | Description |
| :--- | :--- | :--- |
| `OPENROUTER_API_KEY` | Yes | Your OpenRouter API key |
| `OPENROUTER_MODEL` | Yes | Vision-capable OpenRouter model (e.g., `nvidia/nemotron-3.5-super-vl:free`) |
| `OCR_SPACE_API_KEY` | Optional | Dedicated OCR.space key for faster Thai slip OCR |

> [!NOTE]
> Alternatively, you can enter an OpenRouter API key override directly in **Settings** inside the app.

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Verify & Build 

```bash
npm run test:check   # Runs 30 automated checks (bank, AI tools, insights, prompts, dates, quota cycle)
npm run build        # Production TypeScript & Next.js build
```

| Command | Purpose |
| :--- | :--- |
| `npm run test:check` | Runs 30 automated checks (bank, AI tools, insights, prompts, dates, quota cycle) |
| `npm run build` | Production TypeScript & Next.js build |



