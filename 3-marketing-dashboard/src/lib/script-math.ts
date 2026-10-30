// Pure script arithmetic shared by the server (parsing/saving) and the browser (live counters while typing).
// No Node imports here on purpose: this file is bundled into client code.

/** Used only when script-style.md has no speaking rate yet. The UI labels it as an assumption. */
export const DEFAULT_WORDS_PER_SECOND = 2.5;
export const HOOK_SECONDS = 3;

export type ScriptParts = { hook: string; body: string; cta: string; missing: string };

/** Words that are actually spoken: placeholders like [يحدده صاحب المشروع: ...] and markdown symbols don't count. */
export function countWords(text: string): number {
  const cleaned = text.replace(/\[[^\]]*\]/g, " ").replace(/[*_#>`~]/g, " ");
  return cleaned.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

/**
 * The agent's template ends spoken lines with "— N كلمات" (and a real run did exactly that on the Hook). It is a note
 * about the line, not part of what is said: left in, it shows up in the editor, gets saved back into the Hook and
 * adds words to the duration estimate.
 */
export function stripWordCountNotes(text: string): string {
  const count = "[0-9٠-٩]+[ \\t]*كلم(?:ة|ات)";
  return text.replace(new RegExp(`[ \\t]*(?:[—–-][ \\t]*${count}|\\([ \\t]*${count}[ \\t]*\\))[ \\t]*$`, "gm"), "");
}

export function hasPlaceholders(text: string): boolean {
  return /\[يحدده[^\]]*\]/.test(text);
}

export function estimateSeconds(words: number, wordsPerSecond: number): number {
  return Math.round(words / wordsPerSecond);
}

export type DurationInfo = {
  words: number;
  seconds: number;
  rate: number;
  rateIsAssumed: boolean;
  hookWords: number;
  hookSeconds: number;
  hookTooLong: boolean;
};

export function describeDuration(parts: Pick<ScriptParts, "hook" | "body" | "cta">, styleRate: number | null): DurationInfo {
  const rate = styleRate ?? DEFAULT_WORDS_PER_SECOND;
  const hookWords = countWords(parts.hook);
  const words = hookWords + countWords(parts.body) + countWords(parts.cta);
  const hookSeconds = hookWords / rate;
  return {
    words,
    seconds: estimateSeconds(words, rate),
    rate,
    rateIsAssumed: styleRate === null,
    hookWords,
    hookSeconds,
    hookTooLong: hookSeconds > HOOK_SECONDS + 0.5,
  };
}
