// Password hashing with scrypt (node:crypto, no dependency). Kept free of app imports on purpose: the
// create-admin script runs this file directly with Node.
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 200;

const PARAMS = { N: 2 ** 15, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
// scrypt needs about 128 * N * r bytes; leave headroom so it never fails on the limit itself.
const maxmemFor = (N: number, r: number) => 128 * N * r * 2;

function derive(password: string, salt: Buffer, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password.normalize("NFKC"), salt, KEY_LENGTH, { N, r, p, maxmem: maxmemFor(N, r) }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

/** Stored as `scrypt$N$r$p$salt$hash` so the cost can be raised later without breaking old hashes. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, PARAMS.N, PARAMS.r, PARAMS.p);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const [N, R, P] = [Number(n), Number(r), Number(p)];
  // A tampered row must not be able to ask for an absurd amount of memory.
  if (![N, R, P].every(Number.isInteger) || N < 2 ** 10 || N > 2 ** 17 || R < 1 || R > 16 || P < 1 || P > 4) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await derive(password, Buffer.from(salt, "base64url"), N, R, P);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

let dummy: Promise<string> | undefined;
/** A real hash nobody knows the password of: verified against when the email does not exist, so timing doesn't leak it. */
export function dummyHash(): Promise<string> {
  return (dummy ??= hashPassword(randomBytes(24).toString("base64url")));
}

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `الباسورد لازم يكون ${MIN_PASSWORD_LENGTH} حرف على الأقل`;
  if (password.length > MAX_PASSWORD_LENGTH) return `الباسورد أطول من ${MAX_PASSWORD_LENGTH} حرف`;
  if (/^(.)\1+$/.test(password)) return "الباسورد ضعيف جدًا";
  return null;
}
