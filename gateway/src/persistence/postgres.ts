import pg from "pg";
import type { ConversationRecord, ConversationStore } from "./types.js";

const { Pool } = pg;

export interface PostgresStoreConfig {
  connectionString: string;
}

/**
 * Adaptador Postgres de `ConversationStore`. Requiere que el esquema de
 * gateway/sql/001_init.sql ya esté aplicado (docker-compose lo aplica solo
 * al primer arranque vía docker-entrypoint-initdb.d).
 */
export class PostgresConversationStore implements ConversationStore {
  readonly backend = "postgres" as const;
  private readonly pool: pg.Pool;

  constructor(config: PostgresStoreConfig) {
    this.pool = new Pool({ connectionString: config.connectionString });
  }

  /** Comprueba la conexión; lanza si Postgres no responde. Úsalo antes de
   * confiar en este adaptador (el factory hace fallback a JSONL si falla). */
  async ping(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("SELECT 1");
    } finally {
      client.release();
    }
  }

  async save(record: ConversationRecord): Promise<void> {
    const query = `
      INSERT INTO conversations (
        created_at, channel, task_type, model, question, answer,
        tools_used, citations, input_tokens, output_tokens,
        cache_read_tokens, cache_write_tokens, estimated_cost_usd,
        stop_reason, is_error, error_message, duration_ms, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13,
        $14, $15, $16, $17, $18
      )
    `;
    const values = [
      record.createdAt,
      record.channel,
      record.taskType,
      record.model,
      record.question,
      record.answer,
      JSON.stringify(record.toolsUsed),
      JSON.stringify(record.citations),
      record.inputTokens,
      record.outputTokens,
      record.cacheReadTokens,
      record.cacheWriteTokens,
      record.estimatedCostUsd,
      record.stopReason ?? null,
      record.isError,
      record.errorMessage ?? null,
      record.durationMs ?? null,
      JSON.stringify(record.metadata ?? {}),
    ];
    await this.pool.query(query, values);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
