// A small tagged-template layer over mysql2, so the queries keep the shape they had before the move off Postgres:
//
//   const rows = await db<{ id: string }>`select id from leads where status = ${status}`;
//
// Values are never concatenated into the text: they are sent as parameters. Fragments (`db\`and x = ${y}\``, db.unsafe,
// db.list, db.json) can be nested inside another query. A query runs when it is awaited.
//
// No `server-only` import here on purpose: the CLI scripts and the tests use it too.

import mysql, { type Pool, type PoolConnection, type PoolOptions } from "mysql2/promise";

type Runner = Pick<Pool | PoolConnection, "query">;

/** Rows of a SELECT, or the outcome of a write: `count` = rows matched/changed, `insertId` = AUTO_INCREMENT id if any. */
export type Result<T> = T[] & { count: number; insertId: number };

/** `count` and `insertId` are not enumerable, so a result still compares equal to a plain array of rows. */
function withMeta<T>(rows: T[], count: number, insertId: number): Result<T> {
  return Object.defineProperties(rows, { count: { value: count }, insertId: { value: insertId } }) as Result<T>;
}

// Plain fields, no constructor parameter properties: the CLI scripts run this file with Node's type stripping.
class Fragment {
  readonly text: string;
  readonly params: unknown[];

  constructor(text: string, params: unknown[]) {
    this.text = text;
    this.params = params;
  }
}

class Query<T> extends Fragment implements PromiseLike<Result<T>> {
  private readonly runner: Runner;

  constructor(text: string, params: unknown[], runner: Runner) {
    super(text, params);
    this.runner = runner;
  }

  then<A = Result<T>, B = never>(onfulfilled?: ((value: Result<T>) => A | PromiseLike<A>) | null, onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null): Promise<A | B> {
    return this.execute().then(onfulfilled, onrejected);
  }

  catch<B = never>(onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null): Promise<Result<T> | B> {
    return this.execute().catch(onrejected);
  }

  private async execute(): Promise<Result<T>> {
    const [raw] = await this.runner.query(this.text, this.params);
    if (Array.isArray(raw)) return withMeta(raw as T[], raw.length, 0);
    const header = raw as { affectedRows?: number; insertId?: number };
    return withMeta([] as T[], header.affectedRows ?? 0, header.insertId ?? 0);
  }
}

export type Json = { readonly __json: string };

export interface Db {
  /** `db<Row[]>` types the rows, as postgres.js did. */
  <R extends readonly unknown[] = Record<string, unknown>[]>(strings: TemplateStringsArray, ...values: unknown[]): Query<R[number]>;
  /** Raw SQL text, inserted as is. Only ever pass constants, never user input. */
  unsafe(text: string): Fragment;
  /** `(?, ?, ?)` for an IN list. An empty list matches nothing. */
  list(values: readonly unknown[]): Fragment;
  /** A value stored in a JSON column. */
  json(value: unknown): Json;
  /** Runs `fn` in a transaction on one connection: commits if it returns, rolls back if it throws. */
  begin<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  end(): Promise<void>;
}

const isJson = (value: unknown): value is Json => typeof value === "object" && value !== null && "__json" in value;

function build(runner: Runner, root: Pool | null): Db {
  const db = (<R extends readonly unknown[]>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0];
    const params: unknown[] = [];
    values.forEach((value, i) => {
      if (value instanceof Fragment) {
        text += value.text;
        params.push(...value.params);
      } else {
        text += "?";
        params.push(isJson(value) ? value.__json : value === undefined ? null : value);
      }
      text += strings[i + 1];
    });
    return new Query<R[number]>(text, params, runner);
  }) as Db;

  db.unsafe = (text) => new Fragment(text, []);
  db.list = (values) => (values.length === 0 ? new Fragment("(null)", []) : new Fragment(`(${values.map(() => "?").join(", ")})`, [...values]));
  db.json = (value) => ({ __json: JSON.stringify(value) });
  db.begin = async (fn) => {
    if (!root) throw new Error("Nested transactions are not supported");
    const connection = await root.getConnection();
    try {
      await connection.query("START TRANSACTION");
      const result = await fn(build(connection, null));
      await connection.query("COMMIT");
      return result;
    } catch (error) {
      await connection.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  };
  db.end = async () => {
    await root?.end();
  };
  return db;
}

/** True when an INSERT/UPDATE broke a UNIQUE index (the MySQL counterpart of Postgres' 23505). */
export const isDuplicateKey = (error: unknown): boolean => (error as { code?: string } | null)?.code === "ER_DUP_ENTRY";

/** A JSON column comes back parsed on MySQL, as text on MariaDB. */
export function fromJson<T = unknown>(value: unknown): T {
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
}

// Same behaviour on MySQL 8 and MariaDB: errors instead of silent truncation, and every timestamp in UTC.
const SESSION_SETUP = "SET time_zone = '+00:00', sql_mode = 'STRICT_ALL_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'";

// BOOLEAN is TINYINT(1) in MySQL: hand it to the app as true/false, like every other driver does.
const typeCast: PoolOptions["typeCast"] = (field, next) => {
  if (field.type === "TINY" && field.length === 1) {
    const text = field.string();
    return text === null ? null : text !== "0";
  }
  return next();
};

export type ConnectOptions = Partial<PoolOptions> & { multipleStatements?: boolean };

export function connect(url: string, options: ConnectOptions = {}): Db {
  const pool = mysql.createPool({
    uri: url,
    connectionLimit: 5,
    waitForConnections: true,
    connectTimeout: 5000,
    idleTimeout: 20000,
    timezone: "Z",
    typeCast,
    charset: "utf8mb4",
    // An UPDATE reports the rows it matched, not only the rows whose values changed.
    flags: ["+FOUND_ROWS"],
    supportBigNumbers: true,
    bigNumberStrings: false,
    ...options,
  });
  // The first query on a new connection is queued ahead of anything the caller sends.
  pool.pool.on("connection", (connection) => {
    connection.query(SESSION_SETUP);
  });
  return build(pool, pool);
}
