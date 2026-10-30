import type { AuthMode } from "../env";

/**
 * User-facing (Arabic) explanations for the ways a real run can fail on authentication, limits or billing.
 * Pure functions on purpose: the wording depends on HOW the user signs in, and that is easy to get wrong.
 */

export const NOT_LOGGED_IN =
  "مش مسجّل دخول لـ Claude. شغّل `claude` في الـ terminal واعمل /login، أو حط ANTHROPIC_API_KEY في .env.local، وبعدين أعد تشغيل السيرفر.";

const LOGIN_EXPIRED = "الدخول لـ Claude منتهي أو مش موجود. شغّل `claude` في الـ terminal واعمل /login، وبعدين جرّب تاني.";
const KEY_INVALID = "مفتاح الـ API غير صالح أو منتهي. راجع ANTHROPIC_API_KEY في .env.local.";

/** Maps an assistant-message error code from the Agent SDK to a message, or null when it has no special wording. */
export function failureFor(code: string | null | undefined, mode: AuthMode): string | null {
  switch (code) {
    case "authentication_failed":
      return mode === "subscription" ? LOGIN_EXPIRED : KEY_INVALID;
    case "rate_limit":
      return mode === "subscription"
        ? "حد استخدام اشتراكك خلص دلوقتي. استنى لحد ما يتجدد وجرّب تاني."
        : "وصلت لحد معدل الطلبات (rate limit). استنى شوية وجرّب تاني.";
    case "oauth_org_not_allowed":
      return "المنظمة اللي الدخول بتاعك تابع لها مش مسموح لها تستخدم Claude بالطريقة دي. راجع إعدادات حسابك.";
    case "account_on_hold":
      return "حسابك موقوف مؤقتًا من Anthropic. راجع بريدك أو إعدادات الحساب.";
    case "verification_required":
      return "Anthropic طالبة تأكيد على الحساب قبل الاستخدام. افتح `claude` وكمّل التأكيد.";
    case "billing_error":
      return mode === "subscription" ? "فيه مشكلة في اشتراكك أو الفوترة. راجع حسابك على claude.ai." : "فيه مشكلة في الفوترة أو رصيد الـ API. راجع Console.";
    case "overloaded":
      return "خدمة Claude مشغولة دلوقتي. جرّب بعد شوية.";
    case "model_not_found":
      return "الموديل المحدد في CLAUDE_MODEL مش متاح لحسابك. جرّب sonnet أو غيّره.";
    default:
      return null;
  }
}

export function looksLikeAuthProblem(text: string): boolean {
  return /invalid api key|authentication|unauthorized|not logged in|please run \/login|\b401\b|api key/i.test(text);
}

export function budgetMessage(mode: AuthMode, usd: number): string {
  return mode === "subscription"
    ? `حد الاستهلاك التقديري للتشغيل ($${usd}) خلص قبل ما الـ Agent يخلّص. زوّد RUN_BUDGET_USD في .env.local أو قسّم الشغل.`
    : `الميزانية المحددة للتشغيل ($${usd}) خلصت قبل ما الـ Agent يخلّص. زوّد RUN_BUDGET_USD في .env.local أو قسّم الشغل.`;
}
