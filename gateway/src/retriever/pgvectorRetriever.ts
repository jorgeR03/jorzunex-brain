import pg from "pg";
import type { Embedder } from "../embedder/types.js";
import type { Retriever, RetrievedChunk } from "./types.js";

const { Pool } = pg;

/** Convierte un vector JS en el literal de texto que pgvector espera: "[0.1,0.2,...]". */
function toPgVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

/**
 * Implementación de `Retriever` sobre PostgreSQL + pgvector. Embebe la
 * consulta con el mismo `Embedder` usado en la ingesta y ordena
 * `document_chunks` por distancia coseno (`<=>`), devolviendo similaridad
 * (`1 - distancia`) para que un score más alto sea siempre "más relevante".
 */
export class PgVectorRetriever implements Retriever {
  private readonly pool: pg.Pool;
  private readonly embedder: Embedder;

  constructor(connectionString: string, embedder: Embedder) {
    this.pool = new Pool({ connectionString });
    this.embedder = embedder;
  }

  async retrieve(query: string, topK: number): Promise<RetrievedChunk[]> {
    const [queryVector] = await this.embedder.embed([query]);
    const literal = toPgVectorLiteral(queryVector);

    const result = await this.pool.query(
      `
      SELECT source_path, chunk_index, content, 1 - (embedding <=> $1::vector) AS score
      FROM document_chunks
      ORDER BY embedding <=> $1::vector
      LIMIT $2
      `,
      [literal, topK],
    );

    return result.rows.map((row) => ({
      sourcePath: row.source_path as string,
      chunkIndex: row.chunk_index as number,
      content: row.content as string,
      score: Number(row.score),
    }));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
