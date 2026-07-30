import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Raíz del proyecto gateway/ (gateway/src/config.ts -> gateway/). */
export const GATEWAY_ROOT = path.resolve(here, "..");

/** Raíz del repo completo ("Cerebro JorZunex"): gateway/ -> repo root. */
export const REPO_ROOT = path.resolve(GATEWAY_ROOT, "..");

export type StorageBackend = "postgres" | "jsonl" | "auto";

export interface LangfuseConfig {
  /** undefined => integración desactivada (no rompe nada si no está configurada). */
  publicKey?: string;
  secretKey?: string;
  baseUrl: string;
}

export interface BrainConfig {
  anthropicApiKey?: string;
  storageBackend: StorageBackend;
  postgres: {
    connectionString: string;
  };
  jsonlPath: string;
  /** Directorios (relativos a REPO_ROOT) que forman el conocimiento del Brain. */
  knowledgeDirs: string[];
  langfuse: LangfuseConfig;
}

function buildPostgresConnectionString(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const user = process.env.POSTGRES_USER ?? "brain";
  const password = process.env.POSTGRES_PASSWORD ?? "brain_dev_password";
  const host = process.env.POSTGRES_HOST ?? "localhost";
  const port = process.env.POSTGRES_PORT ?? "5432";
  const db = process.env.POSTGRES_DB ?? "jorzunex_brain";
  return `postgresql://${user}:${password}@${host}:${port}/${db}`;
}

export function loadConfig(): BrainConfig {
  const storageBackend = (process.env.BRAIN_STORAGE_BACKEND as StorageBackend) || "auto";

  return {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    storageBackend,
    postgres: {
      connectionString: buildPostgresConnectionString(),
    },
    jsonlPath: process.env.BRAIN_JSONL_PATH ?? path.join(GATEWAY_ROOT, "data", "conversations.jsonl"),
    knowledgeDirs: ["docs", "prompts"],
    langfuse: {
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_BASE_URL ?? "http://localhost:3000",
    },
  };
}
