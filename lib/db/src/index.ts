// Re-export schema + lazy DB client.
// Schema imports are safe for frontend consumers; the client proxy only initializes on first use.
export * from "./schema";
export { db, pool } from "./client";
