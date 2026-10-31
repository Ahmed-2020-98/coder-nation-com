// npm run db:migrate: creates/updates the tables in DATABASE_URL (MySQL / MariaDB).
import { connect } from "../src/server/sql.ts";
import { migrate } from "../db/migrate.mjs";
import { loadEnv } from "./lib/env.mjs";

loadEnv();
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Put it in .env.local (see .env.example).");
  process.exit(1);
}
const sql = connect(process.env.DATABASE_URL, { connectionLimit: 1, multipleStatements: true });
try {
  const applied = await migrate(sql);
  console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Database is up to date.");
} catch (error) {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
