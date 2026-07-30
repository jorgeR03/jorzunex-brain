#!/usr/bin/env node
/**
 * Auto-actualización del cerebro: observa en vivo los archivos .md de este
 * repo (docs/, prompts/ — la vault de Obsidian) y de cada proyecto real bajo
 * ProyectosJorZunex, y re-ingesta SOLO el archivo que cambió (no el corpus
 * completo — por eso es viable dejarlo corriendo todo el día).
 *
 * Responde al pedido de Jorge: "el cerebro debería actualizarse solo".
 *
 * Uso: npm run watch:ingest   (desde gateway/, déjalo corriendo en segundo
 * plano; Ctrl+C para detener). Requiere Postgres arriba.
 *
 * Seguridad: mismo alcance que runProjects.ts — solo .md, nunca código
 * fuente ni archivos con secretos (chokidar solo mira extensión .md).
 */
import path from "node:path";
import { readFile } from "node:fs/promises";
import chokidar from "chokidar";
import pg from "pg";
import { REPO_ROOT, loadConfig } from "../config.js";
import { getDefaultEmbedder, type Embedder } from "../embedder/index.js";
import { chunkMarkdown } from "./chunker.js";

const { Pool } = pg;

const PROJECTS_ROOT = path.resolve(process.env.DEV_AGENT_PROJECTS_ROOT ?? "C:/Users/jorge/ProyectosJorZunex");
const SELF_REPO_NAME = "Cerebro JorZunex";
const PROJECTS_SOURCE_PREFIX = "proyectos-reales";
const IGNORED = /node_modules|[\\/]\.git[\\/]|[\\/]dist[\\/]|[\\/]build[\\/]/;
const DEBOUNCE_MS = 1500; // agrupa guardados rápidos consecutivos del mismo archivo

function toPgVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

/** Resuelve el `source_path` (mismo esquema que run.ts / runProjects.ts) según de qué raíz venga el archivo. */
function resolveSourcePath(absolutePath: string): string | null {
  if (absolutePath.startsWith(REPO_ROOT + path.sep)) {
    return path.relative(REPO_ROOT, absolutePath).replace(/\\/g, "/");
  }
  if (absolutePath.startsWith(PROJECTS_ROOT + path.sep)) {
    const relativeToProjects = path.relative(PROJECTS_ROOT, absolutePath);
    const [project, ...rest] = relativeToProjects.split(path.sep);
    if (!project || project === SELF_REPO_NAME || rest.length === 0) return null; // es este mismo repo, o la raíz — ya cubierto por REPO_ROOT
    return `${PROJECTS_SOURCE_PREFIX}/${project}/${rest.join("/").replace(/\\/g, "/")}`;
  }
  return null;
}

async function ingestFile(pool: pg.Pool, embedder: Embedder, absolutePath: string): Promise<void> {
  const sourcePath = resolveSourcePath(absolutePath);
  if (!sourcePath) return;

  try {
    const content = await readFile(absolutePath, "utf8");
    const chunks = chunkMarkdown(content);

    await pool.query("DELETE FROM document_chunks WHERE source_path = $1", [sourcePath]);
    if (chunks.length === 0) {
      console.log(`[watch] ${sourcePath}: sin contenido, chunks eliminados.`);
      return;
    }

    const vectors = await embedder.embed(chunks.map((c) => c.text));
    for (let i = 0; i < chunks.length; i++) {
      await pool.query(
        `INSERT INTO document_chunks (source_path, chunk_index, content, embedding, metadata)
         VALUES ($1, $2, $3, $4::vector, $5::jsonb)`,
        [sourcePath, chunks[i].index, chunks[i].text, toPgVectorLiteral(vectors[i]), JSON.stringify({ model: embedder.modelName })],
      );
    }
    console.log(`[watch] ${sourcePath}: reingestado (${chunks.length} chunk(s)).`);
  } catch (error) {
    console.error(`[watch] ${sourcePath ?? absolutePath}: ERROR — ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function removeFile(pool: pg.Pool, absolutePath: string): Promise<void> {
  const sourcePath = resolveSourcePath(absolutePath);
  if (!sourcePath) return;
  await pool.query("DELETE FROM document_chunks WHERE source_path = $1", [sourcePath]);
  console.log(`[watch] ${sourcePath}: archivo borrado, chunks eliminados.`);
}

async function main(): Promise<void> {
  const config = loadConfig();
  const embedder = getDefaultEmbedder();
  const pool = new Pool({ connectionString: config.postgres.connectionString });

  try {
    await pool.query("SELECT 1");
  } catch (error) {
    console.error("[watch] No se pudo conectar a Postgres. Levanta infra/docker-compose.yml primero.");
    console.error(`[watch] Detalle: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }

  console.log(`[watch] Cargando embedder (${embedder.modelName})...`);
  await embedder.embed(["warmup"]); // fuerza la carga del modelo antes de vigilar (evita el retraso en el primer cambio real)

  const watchRoots = [
    path.join(REPO_ROOT, "docs"),
    path.join(REPO_ROOT, "prompts"),
    PROJECTS_ROOT,
  ];

  const timers = new Map<string, NodeJS.Timeout>();
  function debounced(absolutePath: string, fn: () => void): void {
    const existing = timers.get(absolutePath);
    if (existing) clearTimeout(existing);
    timers.set(
      absolutePath,
      setTimeout(() => {
        timers.delete(absolutePath);
        fn();
      }, DEBOUNCE_MS),
    );
  }

  // El filtro por extensión .md se hace en cada handler (add/change/unlink);
  // aquí `ignored` solo excluye directorios pesados/irrelevantes para que
  // chokidar ni siquiera los recorra (node_modules de 10 proyectos sería
  // decenas de miles de archivos vigilados si no se excluyen).
  const watcher = chokidar.watch(watchRoots, {
    ignored: (filePath: string) => IGNORED.test(filePath),
    ignoreInitial: true,
    persistent: true,
    depth: 30,
  });

  watcher
    .on("add", (filePath: string) => {
      if (!filePath.toLowerCase().endsWith(".md")) return;
      debounced(filePath, () => void ingestFile(pool, embedder, filePath));
    })
    .on("change", (filePath: string) => {
      if (!filePath.toLowerCase().endsWith(".md")) return;
      debounced(filePath, () => void ingestFile(pool, embedder, filePath));
    })
    .on("unlink", (filePath: string) => {
      if (!filePath.toLowerCase().endsWith(".md")) return;
      debounced(filePath, () => void removeFile(pool, filePath));
    })
    .on("error", (error: unknown) => console.error("[watch] Error del watcher:", error));

  console.log(`[watch] Vigilando cambios en:\n  - ${watchRoots.join("\n  - ")}\n[watch] Listo. Guarda un .md para probarlo.`);

  process.on("SIGINT", async () => {
    console.log("\n[watch] Cerrando...");
    await watcher.close();
    await pool.end();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("[watch] Error fatal:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
