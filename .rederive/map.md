# Rederive Problem Map — Finora (Final B1/B2 Prep)

1. **Root Problem & Interaction Modes** — Why build Finora, and how should free-form financial Q&A/commands differ from fixed-step receipt/slip processing?
2. **Data Grounding & Financial Math** — How to give the LLM accurate live financial metrics (balances, burn rate, safe spend) without slow round-trips, token bloat, or arithmetic hallucinations?
3. **Safe Financial Mutations (Guardrails)** — How to allow AI-triggered writes to money/budgets safely without auto-corrupting data or causing clunky multi-turn chat confirmations?
4. **Multi-Action & Dependent Commands** — How to process a single user message that creates a new category and immediately logs expenses into it (or logs multiple expenses at once)?
5. **Runtime Resilience & Input Normalization** — How to prevent runaway tool loops, crashed JSON parsing, fake confirmations, Thai date/slang mismatches, and blocked expense recording?
6. **Thai Bank Slip Pipeline** — How to handle large mobile screenshots, Thai spelling accuracy, varied bank layouts, and distinguishing income vs expense reliably?
7. **LLM Gateway & Transient Failures** — How to stay decoupled from a single model vendor and survive rate limits/timeouts/HTML error pages?
