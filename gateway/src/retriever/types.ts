/**
 * Interfaz `Retriever` — única puerta de entrada para recuperar contexto
 * relevante del corpus indexado (RAG). Ningún consumidor (gateway, canales)
 * debe hablarle a pgvector/Postgres directamente: todos pasan por aquí, así
 * se puede cambiar de backend (p. ej. Qdrant en fase 2, ver ADR-0001) sin
 * tocar el resto del código — ver docs/investigacion/07-GUIA-PARA-AGENTES-CLAUDE.md §4.5.
 */

export interface RetrievedChunk {
  sourcePath: string;
  chunkIndex: number;
  content: string;
  /** Similaridad coseno en [0, 1] (1 = idéntico). Cuanto más alto, más relevante. */
  score: number;
}

export interface Retriever {
  /** Devuelve los `topK` fragmentos más relevantes para `query`, ordenados por relevancia descendente. */
  retrieve(query: string, topK: number): Promise<RetrievedChunk[]>;
  close(): Promise<void>;
}
