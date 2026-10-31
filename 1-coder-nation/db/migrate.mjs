// Applies db/migrations/*.sql in name order and remembers what ran.
// Shared by `npm run db:migrate` and the integration tests. Pass a Db made with { multipleStatements: true }.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyMigrations } from "../src/server/migrate-core.ts";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

/** @param {import("../src/server/sql.ts").Db} sql @returns {Promise<string[]>} names applied by this call */
export async function migrate(sql) {
  const list = fs.readdirSync(dir).filter((name) => name.endsWith(".sql")).map((name) => ({ name, sql: fs.readFileSync(path.join(dir, name), "utf8") }));
  return applyMigrations(sql, list);
}
