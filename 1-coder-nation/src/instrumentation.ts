// Runs once when the Node.js server starts. With RUN_MIGRATIONS_ON_START=1 it brings the database up to date, so a
// host that cannot reach the database from outside (shared MySQL on localhost) still gets its tables. Safe to leave
// on: applied migrations are skipped, and a database lock stops two instances from migrating at the same time.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.RUN_MIGRATIONS_ON_START !== "1") return;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return;

  const { connect } = await import("./server/sql");
  const { applyMigrations } = await import("./server/migrate-core");
  const { MIGRATIONS } = await import("./server/migrations.generated");
  const db = connect(url, { connectionLimit: 1, multipleStatements: true });
  try {
    const applied = await db.begin(async (tx) => {
      const [lock] = await tx<{ ok: number | null }[]>`select get_lock('coder_nation_migrate', 60) as ok`;
      if (Number(lock?.ok) !== 1) throw new Error("could not get the migration lock");
      try {
        return await applyMigrations(tx, MIGRATIONS);
      } finally {
        await tx`select release_lock('coder_nation_migrate')`.catch(() => {});
      }
    });
    console.log(applied.length ? `[migrate] applied: ${applied.join(", ")}` : "[migrate] database is up to date");
  } catch (error) {
    console.error("[migrate] failed:", error instanceof Error ? error.message : error);
  } finally {
    await db.end().catch(() => {});
  }
}
