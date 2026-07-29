import type { BrainConfig } from "../config.js";
import { getDefaultEmbedder } from "../embedder/index.js";
import { PgVectorRetriever } from "./pgvectorRetriever.js";
import type { Retriever } from "./types.js";

export type { Retriever, RetrievedChunk } from "./types.js";

/**
 * Factory del Retriever por defecto (pgvector). Devuelve `null` si Postgres
 * no responde — el RAG es "best effort": si no hay base vectorial
 * disponible, `askBrain` cae de vuelta al acceso Read/Glob/Grep de solo
 * lectura (ver gateway.ts) en vez de bloquear al usuario.
 */
export async function createRetriever(config: BrainConfig): Promise<Retriever | null> {
  const embedder = getDefaultEmbedder();
  const retriever = new PgVectorRetriever(config.postgres.connectionString, embedder);
  try {
    // Ping barato: si document_chunks no existe o Postgres no responde, falla aquí.
    await retriever.retrieve("ping", 1);
    return retriever;
  } catch (error) {
    await retriever.close().catch(() => undefined);
    process.stderr.write(
      `[brain] Retriever (pgvector) no disponible (${
        error instanceof Error ? error.message : String(error)
      }). Se responde solo con acceso Read/Glob/Grep a docs/ y prompts/.\n`,
    );
    return null;
  }
}
