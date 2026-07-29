#!/usr/bin/env node
/**
 * Script de ingesta RAG (PoC-2): recorre docs/ y prompts/, trocea cada
 * Markdown, genera embeddings locales (gratis, sin API externa) y guarda
 * los fragmentos en `document_chunks` (Postgres + pgvector).
 *
 * No usa n8n todavía (aún no está desplegado, ver
 * docs/investigacion/07-GUIA-PARA-AGENTES-CLAUDE.md §3.2.3) — es un script
 * que se ejecuta a mano o por cron simple hasta que exista el flujo n8n.
 *
 * Uso: npm run ingest   (desde gateway/)
 * Requiere Postgres arriba (infra/docker-compose.yml) — este pipeline no
 * tiene fallback JSONL: los embeddings solo tienen sentido con pgvector.
 */
import path from "node:path";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { REPO_ROOT, loadConfig } from "../config.js";
import { getDefaultEmbedder } from "../embedder/index.js";
import { chunkMarkdown } from "./chunker.js";
import { walkMarkdownFiles } from "./walkMarkdown.js";

const { Pool } = pg;

function toPgVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const embedder = getDefaultEmbedder();
  const pool = new Pool({ connectionString: config.postgres.connectionString });

  try {
    await pool.query("SELECT 1");
  } catch (error) {
    console.error(
      "[ingest] No se pudo conectar a Postgres. Levanta infra/docker-compose.yml primero " +
        "(`docker compose up -d` desde infra/). Este pipeline no tiene fallback JSONL: " +
        "los embeddings solo tienen sentido guardados en pgvector.",
    );
    console.error(`[ingest] Detalle: ${error instanceof Error ? error.message : String(error)}`);
    await pool.end();
    process.exitCode = 1;
    return;
  }

  const startedAt = Date.now();
  const knowledgeDirs = config.knowledgeDirs.map((dir) => path.join(REPO_ROOT, dir));

  const files: string[] = [];
  for (const dir of knowledgeDirs) {
    files.push(...(await walkMarkdownFiles(dir)));
  }

  console.log(`[ingest] ${files.length} archivo(s) Markdown encontrados en: ${config.knowledgeDirs.join(", ")}`);
  console.log(`[ingest] Embedder: ${embedder.modelName} (${embedder.dimension} dim) — cargando modelo...`);

  let totalChunks = 0;
  let filesWithErrors = 0;

  for (const absolutePath of files) {
    const relativePath = path.relative(REPO_ROOT, absolutePath).replace(/\\/g, "/");
    try {
      const content = await readFile(absolutePath, "utf8");
      const chunks = chunkMarkdown(content);

      if (chunks.length === 0) {
        console.log(`[ingest]   ${relativePath}: sin contenido, se omite.`);
        continue;
      }

      const vectors = await embedder.embed(chunks.map((c) => c.text));

      // Idempotente: reemplaza los chunks previos de este archivo antes de
      // insertar los nuevos (permite reingestar sin duplicar ni acumular basura).
      await pool.query("DELETE FROM document_chunks WHERE source_path = $1", [relativePath]);

      for (let i = 0; i < chunks.length; i++) {
        await pool.query(
          `INSERT INTO document_chunks (source_path, chunk_index, content, embedding, metadata)
           VALUES ($1, $2, $3, $4::vector, $5::jsonb)`,
          [
            relativePath,
            chunks[i].index,
            chunks[i].text,
            toPgVectorLiteral(vectors[i]),
            JSON.stringify({ model: embedder.modelName }),
          ],
        );
      }

      totalChunks += chunks.length;
      console.log(`[ingest]   ${relativePath}: ${chunks.length} chunk(s).`);
    } catch (error) {
      filesWithErrors++;
      console.error(
        `[ingest]   ${relativePath}: ERROR — ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const durationMs = Date.now() - startedAt;
  console.log(
    `[ingest] Listo: ${files.length} archivo(s), ${totalChunks} chunk(s) guardados en document_chunks ` +
      `(${filesWithErrors} archivo(s) con error) en ${(durationMs / 1000).toFixed(1)}s.`,
  );

  await pool.end();
}

main().catch((error) => {
  console.error("[ingest] Error fatal:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
