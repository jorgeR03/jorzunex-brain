/**
 * Interfaz `ConversationStore` — capa de persistencia de interacciones.
 *
 * Dos adaptadores: Postgres (preferido, docs/adr/ADR-0001) y JSONL local de
 * fallback para cuando Docker/Postgres no están disponibles. Seleccionable
 * por variable de entorno `BRAIN_STORAGE_BACKEND` (ver config.ts). Ningún
 * consumidor debe importar directamente `postgres.ts` o `jsonl.ts` — solo
 * `createConversationStore()` de `./index.ts`.
 */

export interface ConversationRecord {
  createdAt: string; // ISO 8601
  channel: string;
  taskType: string;
  model: string;
  question: string;
  answer: string;
  toolsUsed: string[];
  citations: string[];
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  estimatedCostUsd: number;
  stopReason?: string;
  isError: boolean;
  errorMessage?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface ConversationStore {
  readonly backend: "postgres" | "jsonl";
  /** Persiste una interacción completa. No debe lanzar si falla el registro —
   * debe loguear el error a stderr para no romper la respuesta al usuario. */
  save(record: ConversationRecord): Promise<void>;
  /** Cierra conexiones abiertas (pool de Postgres, streams, etc.). */
  close(): Promise<void>;
}
