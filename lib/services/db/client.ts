import "server-only";
import { createPool, type Pool } from "mysql2/promise";
import { getServerConfig } from "@/lib/services/config";

let pool: Pool | null | undefined;

export function getDbPool(): Pool | null {
  if (pool !== undefined) return pool;
  const cfg = getServerConfig();
  if (!cfg.db.configured) {
    pool = null;
    return null;
  }
  pool = createPool({
    host: cfg.db.host,
    port: cfg.db.port,
    user: cfg.db.user,
    password: process.env.DB_PASSWORD ?? "",
    database: cfg.db.name,
    waitForConnections: true,
    connectionLimit: 5,
    connectTimeout: 10_000,
  });
  return pool;
}

export function resetDbPool(): void {
  if (pool) {
    void pool.end().catch(() => {});
  }
  pool = undefined;
}
