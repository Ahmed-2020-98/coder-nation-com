// npm run admin:create -- --email you@example.com [--reset]
// Asks for the password twice with the keystrokes hidden, so it never appears on screen, in shell history or in logs.
// --reset sets a new password for an existing admin and signs them out everywhere.
import { randomUUID } from "node:crypto";
import { connect } from "../src/server/sql.ts";
import { hashPassword, passwordProblem } from "../src/server/password.ts";
import { loadEnv } from "./lib/env.mjs";

loadEnv();
const args = process.argv.slice(2);
const emailIndex = args.indexOf("--email");
const email = (emailIndex >= 0 ? args[emailIndex + 1] : "")?.trim().toLowerCase();
const reset = args.includes("--reset");

function fail(message) {
  console.error(message);
  process.exit(1);
}
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) fail("Usage: npm run admin:create -- --email you@example.com [--reset]");
if (!process.env.DATABASE_URL) fail("DATABASE_URL is not set. Put it in .env.local (see .env.example), then run `npm run db:migrate`.");
if (!process.stdin.isTTY) fail("This needs an interactive terminal (the password is typed hidden).");

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

const sql = connect(process.env.DATABASE_URL, { connectionLimit: 1 });
try {
  const [existing] = await sql`select id from admins where email = ${email}`;
  if (existing && !reset) fail(`${email} already exists. Use --reset to change the password.`);
  if (!existing && reset) fail(`${email} does not exist yet. Run without --reset to create it.`);

  const password = await askHidden("Password (min 12 characters): ");
  const problem = passwordProblem(password);
  if (problem) fail(`Not accepted: ${problem}`);
  if ((await askHidden("Repeat the password: ")) !== password) fail("The two passwords don't match.");

  const hash = await hashPassword(password);
  if (existing) {
    await sql.begin(async (tx) => {
      await tx`update admins set password_hash = ${hash} where id = ${existing.id}`;
      await tx`delete from sessions where admin_id = ${existing.id}`;
    });
    console.log(`Password updated for ${email}; all sessions were signed out.`);
  } else {
    await sql`insert into admins (id, email, password_hash) values (${randomUUID()}, ${email}, ${hash})`;
    console.log(`Admin created: ${email}. Sign in at /admin/login`);
  }
} catch (error) {
  console.error("Failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
