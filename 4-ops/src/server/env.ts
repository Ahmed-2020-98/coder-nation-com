import "server-only";

export const isProduction = process.env.NODE_ENV === "production";

let devSalt: string | undefined;
/** Secret that makes IP hashes unusable outside this deployment. Required in production, random per process in dev. */
export function ipSalt(): string {
  const configured = process.env.IP_HASH_SALT?.trim();
  if (configured && configured.length >= 16) return configured;
  if (isProduction) throw new Error("IP_HASH_SALT (16+ characters) is required in production");
  return (devSalt ??= `dev-${Math.random().toString(36).slice(2)}${Date.now()}`);
}

/** Shared secret with the public website. null = the intake endpoint is switched off. */
export function intakeSecret(): string | null {
  const value = process.env.INTAKE_SECRET?.trim();
  return value && value.length >= 32 ? value : null;
}

/** Where headless Chrome opens this app to print a proposal. Never derived from a request header. */
export function appUrl(): string {
  return (process.env.APP_URL?.trim() || `http://127.0.0.1:${process.env.PORT || 3020}`).replace(/\/+$/, "");
}

export function chromePath(): string {
  return process.env.CHROME_PATH?.trim() || (process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "google-chrome");
}
