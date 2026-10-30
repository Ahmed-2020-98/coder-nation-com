// npm run user:create -- --email you@example.com --name "Ahmed" --role owner [--reset]
// The password is asked twice with the keystrokes hidden, so it never appears on screen, in shell history or logs.
// --reset sets a new password for an existing user and signs them out everywhere.
import postgres from "postgres";
import { hashPassword, passwordProblem } from "../src/server/password.ts";
import { loadEnv } from "./lib/env.mjs";

loadEnv();
const args = process.argv.slice(2);
const arg = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1]?.trim() : undefined;
};
const email = arg("email")?.toLowerCase();
const name = arg("name");
const role = arg("role") ?? "owner";
const reset = args.includes("--reset");

function fail(message) {
  console.error(message);
  process.exit(1);
}
const usage = 'Usage: npm run user:create -- --email you@example.com --name "Your Name" --role owner|manager|employee [--reset]';
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) fail(usage);
if (!["owner", "manager", "employee"].includes(role)) fail(usage);
if (!reset && (!name || name.length < 2 || name.length > 80)) fail(usage);
if (!process.env.DATABASE_URL) fail("DATABASE_URL is not set. Put it in .env.local (see .env.example), then run `npm run db:migrate`.");
if (!process.stdin.isTTY) fail("This needs an interactive terminal (the password is typed hidden). Run it in Terminal, not from a tool.");

function askHidden(prompt) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\u0003") {
          stdout.write("\n");
          process.exit(130);
        } else if (char === "\r" || char === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          resolve(value);
          return;
        } else if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
        } else if (char >= " ") {
          value += char;
        }
      }
    };
    stdin.on("data", onData);
  });
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  const [existing] = await sql`select id from users where email = ${email}`;
  if (existing && !reset) fail(`${email} already exists. Use --reset to change the password.`);
  if (!existing && reset) fail(`${email} does not exist yet. Run without --reset to create it.`);

  const password = await askHidden("Password (min 12 characters): ");
  const problem = passwordProblem(password);
  if (problem) fail(`Not accepted: ${problem}`);
  if ((await askHidden("Repeat the password: ")) !== password) fail("The two passwords don't match.");

  const hash = await hashPassword(password);
  if (existing) {
    await sql.begin(async (tx) => {
      await tx`update users set password_hash = ${hash}, must_change_password = false, active = true where id = ${existing.id}`;
      await tx`delete from sessions where user_id = ${existing.id}`;
    });
    console.log(`Password updated for ${email}; all sessions were signed out.`);
  } else {
    await sql`insert into users (email, name, role, password_hash) values (${email}, ${name}, ${role}, ${hash})`;
    console.log(`${role} created: ${email}. Sign in at /login`);
  }
} catch (error) {
  console.error("Failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
