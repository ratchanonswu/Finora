export const AI_INSIGHT_HANDOFF_KEY = "finora_pending_ai_insight_prompt_v1";

const DEFAULT_DASHBOARD_INSIGHT_PROMPT =
  "ช่วยวิเคราะห์รายจ่ายหลักในรอบนี้และแนะนำแนวทางปรับที่ตรงจุดจากรายการจริงให้หน่อย";

/** Builds the initial user prompt when navigating from the Dashboard AI Insights card. */
export function buildDashboardInsightPrompt(headline?: string): string {
  const cleanHeadline = headline?.trim();
  if (!cleanHeadline) return DEFAULT_DASHBOARD_INSIGHT_PROMPT;
  return `ช่วยวิเคราะห์ประเด็น "${cleanHeadline}" และแนะนำแนวทางปรับที่ตรงจุดจากรายการจริงให้หน่อย`;
}

/** Stores a one-shot AI prompt in sessionStorage before navigating to /ai-assistant. */
export function queueAiInsightPrompt(headline?: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      AI_INSIGHT_HANDOFF_KEY,
      buildDashboardInsightPrompt(headline)
    );
  } catch {
    // Ignore sessionStorage errors (private mode / quota restrictions)
  }
}

/** Reads and removes any queued one-shot AI prompt from sessionStorage. */
export function consumeAiInsightPrompt(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(AI_INSIGHT_HANDOFF_KEY);
    if (raw !== null) {
      window.sessionStorage.removeItem(AI_INSIGHT_HANDOFF_KEY);
    }
    const trimmed = raw?.trim();
    return trimmed ? trimmed : null;
  } catch {
    return null;
  }
}
