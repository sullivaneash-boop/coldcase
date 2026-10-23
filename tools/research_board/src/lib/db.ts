import "server-only";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";
import { DB_PATH } from "@/lib/archive";

let cached: { db: BetterSQLite3Database<typeof schema>; mtime: number } | null = null;

/** Returns null when the index has not been built yet (run `npm run case`). */
export function getDb() {
  if (!fs.existsSync(DB_PATH)) return null;
  const mtime = fs.statSync(DB_PATH).mtimeMs;
  if (!cached || cached.mtime !== mtime) {
    const sqlite = new Database(DB_PATH);
    sqlite.pragma("journal_mode = WAL");
    cached = { db: drizzle(sqlite, { schema }), mtime };
  }
  return cached.db;
}
