#!/usr/bin/env node
/**
 * Ingesta profunda de los proyectos reales de JorZunex (no solo las fichas
 * resumen de docs/wiki/proyectos/): recorre cada carpeta bajo
 * ProyectosJorZunex (excepto este mismo repo del Brain) y trocea/embebe TODOS
 * sus archivos Markdown (README, docs/, CLAUDE.md, ADRs propios de cada
 * proyecto). Responde al pedido de Jorge de que el cerebro tenga
 * "conocimiento de todo lo que hacemos", no solo un resumen curado.
 *
 * Seguridad (mismo principio que gateway/src/devAgent.ts): SOLO se leen
 * archivos .md (walkMarkdownFiles ya excluye node_modules/.git/dist/build y
 * archivos ocultos) — nunca código fuente, nunca .env, nunca configuración
 * con secretos. Si un proyecto tiene información sensible en un .md
 * (poco común, pero posible), revisar antes de correr este script contra
 * proyectos nuevos.
 *
 * Uso: npm run ingest:projects   (desde gateway/)
 */
import path from "node:path";
import { readFile, readdir } from "node:fs/promises";
import pg from "pg";
import { loadConfig } from "../config.js";
import { getDefaultEmbedder } from "../embedder/index.js";
import { chunkMarkdown } from "./chunker.js";
import { walkMarkdownFiles } from "./walkMarkdown.js";

const { Pool } = pg;

const PROJECTS_ROOT = path.resolve(process.env.DEV_AGENT_PROJECTS_ROOT ?? "C:/Users/jorge/ProyectosJorZunex");
const SELF_REPO_NAME = "Cerebro JorZunex"; // ya se ingesta vía `npm run ingest` (docs/ + prompts/)
const SOURCE_PREFIX = "proyectos-reales"; // distingue estos chunks de docs/wiki/proyectos/*.md (resúmenes curados)

function toPgVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

async function listProjectFolders(): Promise<string[]> {
  const entries = await readdir(PROJECTS_ROOT, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== SELF_REPO_NAME)
    .map((e) => e.name)
    .sort();
}

async function main(): Promise<void> {
  const config = loadConfig();
  const embedder = getDefaultEmbedder();
  const pool = new Pool({ connectionString: config.postgres.connectionString });

  try {
    await pool.query("SELECT 1");
  } catch (error) {
    console.error(
      "[ingest:projects] No se pudo conectar a Postgres. Levanta infra/docker-compose.yml primero.",
    );
    console.error(`[ingest:projects] Detalle: ${error instanceof Error ? error.message : String(error)}`);
    await pool.end();
    process.exitCode = 1;
    return;
  }

  const startedAt = Date.now();
  const projects = await listProjectFolders();
  console.log(`[ingest:projects] ${projects.length} proyecto(s) encontrados bajo ${PROJECTS_ROOT}: ${projects.join(", ")}`);
  console.log(`[ingest:projects] Embedder: ${embedder.modelName} (${embedder.dimension} dim) — cargando modelo...`);

  let totalFiles = 0;
  let totalChunks = 0;
  let filesWithErrors = 0;

  // Idempotente a nivel global: se limpia TODO lo de proyectos-reales antes
  // de reingestar — más simple que rastrear archivos borrados/renombrados
  // proyecto por proyecto, y el corpus es pequeño (~90 archivos).
  await pool.query("DELETE FROM document_chunks WHERE source_path LIKE $1", [`${SOURCE_PREFIX}/%`]);

  for (const project of projects) {
    const projectDir = path.join(PROJECTS_ROOT, project);
    const files = await walkMarkdownFiles(projectDir);
    if (files.length === 0) {
      console.log(`[ingest:projects] ${project}: sin archivos .md, se omite.`);
      continue;
    }

    for (const absolutePath of files) {
      const relativeWithinProject = path.relative(projectDir, absolutePath).replace(/\\/g, "/");
      const sourcePath = `${SOURCE_PREFIX}/${project}/${relativeWithinProject}`;
      totalFiles++;

      try {
        const content = await readFile(absolutePath, "utf8");
        const chunks = chunkMarkdown(content);
        if (chunks.length === 0) continue;

        const vectors = await embedder.embed(chunks.map((c) => c.text));

        for (let i = 0; i < chunks.length; i++) {
          await pool.query(
            `INSERT INTO document_chunks (source_path, chunk_index, content, embedding, metadata)
             VALUES ($1, $2, $3, $4::vector, $5::jsonb)`,
            [
              sourcePath,
              chunks[i].index,
              chunks[i].text,
              toPgVectorLiteral(vectors[i]),
              JSON.stringify({ model: embedder.modelName, project }),
            ],
          );
        }

        totalChunks += chunks.length;
      } catch (error) {
        filesWithErrors++;
        console.error(
          `[ingest:projects]   ${sourcePath}: ERROR — ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    console.log(`[ingest:projects] ${project}: ${files.length} archivo(s) procesados.`);
  }

  const durationMs = Date.now() - startedAt;
  console.log(
    `[ingest:projects] Listo: ${totalFiles} archivo(s), ${totalChunks} chunk(s) guardados ` +
      `(${filesWithErrors} con error) en ${(durationMs / 1000).toFixed(1)}s.`,
  );

  await pool.end();
}

main().catch((error) => {
  console.error("[ingest:projects] Error fatal:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
