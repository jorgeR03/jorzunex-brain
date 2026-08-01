#!/usr/bin/env node
/**
 * Informe semanal proactivo de Atlas (Jarvis pilar 2 — ver docs/VISION.md y
 * ADR-0003 punto 10: "revisión periódica de la wiki/proyectos →
 * sugerencias"). Decisión de Jorge: esto se ejecuta como un script Node
 * local disparado por el Programador de tareas de Windows — NADA de
 * Anthropic Managed Agents (cero infraestructura nueva). Ver
 * gateway/src/scheduled/README.md para el comando `schtasks` exacto.
 *
 * Qué hace, en orden:
 *   1. Recorre cada carpeta bajo PROJECTS_ROOT (menos este propio repo del
 *      Brain) que sea un repo git y lee `git log --since="7 days ago"`.
 *   2. Lee las entradas de los últimos 7 días de los logs de actividad
 *      (docs/wiki/proyectos/_actividad-dev/*.md y _actividad-comercial/*.md
 *      si existen).
 *   3. Revisa la antigüedad de las páginas de wiki de proyectos (señal de
 *      "wiki desactualizada" para las sugerencias proactivas).
 *   4. Envía TODO ese texto crudo en una única llamada al Claude Agent SDK
 *      (sin herramientas — es generación de texto puro, no acceso agéntico)
 *      pidiendo un resumen semanal + 3-5 sugerencias proactivas.
 *   5. Escribe el resultado en docs/wiki/briefings/<YYYY-MM-DD>.md (ese
 *      directorio lo vigila el watcher de ingesta, así que se re-indexa solo).
 *
 * Uso manual: `npm run briefing:weekly` (desde gateway/).
 */
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { resolveModel } from "../modelRouter.js";
import { REPO_ROOT } from "../config.js";

const execFileAsync = promisify(execFile);

const PROJECTS_ROOT = path.resolve(process.env.DEV_AGENT_PROJECTS_ROOT ?? "C:/Users/jorge/ProyectosJorZunex");
const SELF_REPO_NAME = "Cerebro JorZunex"; // este repo no se cuenta como "proyecto real" (mismo patrón que runProjects.ts)

const DEV_ACTIVITY_DIR = path.join(REPO_ROOT, "docs", "wiki", "proyectos", "_actividad-dev");
const COMMERCIAL_ACTIVITY_DIR = path.join(REPO_ROOT, "docs", "wiki", "proyectos", "_actividad-comercial");
const WIKI_PROJECTS_DIR = path.join(REPO_ROOT, "docs", "wiki", "proyectos");
const BRIEFINGS_DIR = path.join(REPO_ROOT, "docs", "wiki", "briefings");

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

async function listProjectFolders(): Promise<string[]> {
  const entries = await readdir(PROJECTS_ROOT, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== SELF_REPO_NAME)
    .map((e) => e.name)
    .sort();
}

/** Devuelve el bloque de `git log` de un proyecto, o null si no es un repo git o falló (no fatal). */
async function gatherGitActivity(projectDir: string, projectName: string): Promise<string | null> {
  try {
    await stat(path.join(projectDir, ".git"));
  } catch {
    return null; // no es un repo git — se omite en silencio
  }

  try {
    // execFile (no `exec`) con argumentos como array: nunca pasa por una
    // shell, así que el nombre de la carpeta o cualquier dato no puede
    // inyectar comandos aunque contenga caracteres raros.
    const { stdout } = await execFileAsync(
      "git",
      ["log", "--since=7 days ago", "--oneline"],
      { cwd: projectDir, encoding: "utf8", timeout: 15_000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
    );
    const trimmed = stdout.trim();
    return `### ${projectName}\n${trimmed || "(sin commits en los últimos 7 días)"}`;
  } catch (error) {
    console.warn(
      `[weekly-briefing] ${projectName}: no se pudo leer 'git log' — ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

/** Extrae los bloques "## <timestamp ISO> — ..." cuyo timestamp cae dentro de los últimos 7 días. */
function extractRecentEntries(content: string, cutoffMs: number): string[] {
  const blocks = content.split(/(?=^## )/m).filter((block) => block.trim().startsWith("## "));
  const recent: string[] = [];
  for (const block of blocks) {
    const match = block.match(/^## (\S+)/);
    const timestamp = match ? Date.parse(match[1]) : NaN;
    // Si el timestamp no se puede parsear, se incluye igualmente (mejor un
    // falso positivo ocasional que perder una entrada real por un formato
    // inesperado).
    if (Number.isNaN(timestamp) || timestamp >= cutoffMs) {
      recent.push(block.trim());
    }
  }
  return recent;
}

/** Lee todos los .md de un directorio de logs de actividad y concatena sus entradas recientes. Vacío si el directorio no existe. */
async function readRecentActivityFiles(dir: string, label: string): Promise<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return ""; // carpeta aún no existe (p. ej. _actividad-comercial) — no es un error
  }

  const cutoffMs = Date.now() - SEVEN_DAYS_MS;
  const sections: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) continue;
    const fullPath = path.join(dir, entry.name);
    let content: string;
    try {
      content = await readFile(fullPath, "utf8");
    } catch (error) {
      console.warn(
        `[weekly-briefing] ${label}/${entry.name}: no se pudo leer — ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }
    const recent = extractRecentEntries(content, cutoffMs);
    if (recent.length > 0) {
      sections.push(`### ${entry.name.replace(/\.md$/i, "")}\n\n${recent.join("\n\n")}`);
    }
  }
  return sections.join("\n\n");
}

/** Lista las páginas de wiki de proyectos (docs/wiki/proyectos/*.md, sin bajar a _actividad-*) con su antigüedad — señal para detectar wiki desactualizada. */
async function listWikiPageStaleness(): Promise<string> {
  let entries;
  try {
    entries = await readdir(WIKI_PROJECTS_DIR, { withFileTypes: true });
  } catch {
    return "";
  }

  const lines: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) continue;
    const fullPath = path.join(WIKI_PROJECTS_DIR, entry.name);
    try {
      const info = await stat(fullPath);
      const daysSince = Math.floor((Date.now() - info.mtime.getTime()) / (24 * 60 * 60 * 1000));
      lines.push(`- ${entry.name}: última modificación hace ${daysSince} día(s) (${info.mtime.toISOString().slice(0, 10)})`);
    } catch {
      // ignorar archivo puntual que falle el stat
    }
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  const startedAt = Date.now();

  const projects = await listProjectFolders();
  console.log(`[weekly-briefing] ${projects.length} proyecto(s) encontrados bajo ${PROJECTS_ROOT}.`);

  const gitSections: string[] = [];
  const projectsCovered: string[] = [];
  for (const project of projects) {
    const projectDir = path.join(PROJECTS_ROOT, project);
    const section = await gatherGitActivity(projectDir, project);
    if (section) {
      gitSections.push(section);
      projectsCovered.push(project);
    } else {
      console.log(`[weekly-briefing] ${project}: sin repo git (o sin acceso), se omite del resumen de commits.`);
    }
  }

  console.log("[weekly-briefing] Leyendo logs de actividad dev/comercial de los últimos 7 días...");
  const devActivity = await readRecentActivityFiles(DEV_ACTIVITY_DIR, "_actividad-dev");
  const commercialActivity = await readRecentActivityFiles(COMMERCIAL_ACTIVITY_DIR, "_actividad-comercial");

  console.log("[weekly-briefing] Revisando antigüedad de páginas de wiki de proyectos...");
  const wikiStaleness = await listWikiPageStaleness();

  const rawContext = [
    `## Actividad de commits (git log, últimos 7 días)\n\n${gitSections.length > 0 ? gitSections.join("\n\n") : "(sin actividad de commits registrada)"}`,
    `## Actividad de tareas de desarrollo (Atlas dev, últimos 7 días)\n\n${devActivity || "(sin entradas recientes)"}`,
    `## Actividad comercial (leads, últimos 7 días)\n\n${commercialActivity || "(sin entradas recientes, o la carpeta _actividad-comercial aún no existe)"}`,
    `## Antigüedad de páginas de wiki de proyectos\n\n${wikiStaleness || "(sin páginas encontradas)"}`,
  ].join("\n\n---\n\n");

  console.log(`[weekly-briefing] Contexto reunido (${rawContext.length} caracteres). Llamando a Claude...`);

  const model = resolveModel({ task: "default" });
  const systemPrompt = `Eres Atlas, el asistente interno de JorZunex, generando el informe semanal proactivo (pilar "Jarvis proactivo" de docs/VISION.md; ver también ADR-0003 punto 10).

Se te da información cruda reunida automáticamente por un script: actividad de commits git de los últimos 7 días por proyecto, entradas recientes de logs de tareas de desarrollo y de actividad comercial, y la antigüedad de las páginas de wiki de cada proyecto.

Responde en español, sin emojis, en Markdown, con EXACTAMENTE estas dos secciones:

## Resumen de la semana
3 a 8 frases resumiendo qué pasó, proyecto por proyecto cuando haya algo relevante. Si un proyecto no tuvo actividad, puedes omitirlo o mencionarlo en una frase.

## Sugerencias proactivas
Una lista de 3 a 5 sugerencias concretas y accionables (páginas de wiki desactualizadas, proyectos sin actividad reciente que podrían necesitar atención, seguimientos implícitos en los logs de actividad dev/comercial, etc.).

No inventes información que no esté en el contexto proporcionado. Si el contexto es escaso, dilo explícitamente en vez de rellenar con suposiciones.`;

  let resultText = "";
  try {
    const stream = query({
      prompt: rawContext,
      options: {
        model,
        systemPrompt,
        tools: [],
        allowedTools: [],
        disallowedTools: ["Read", "Glob", "Grep", "Write", "Edit", "Bash", "WebFetch", "WebSearch", "NotebookEdit"],
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        settingSources: [],
        maxTurns: 1,
      },
    });

    for await (const message of stream) {
      if (message.type === "result") {
        if (message.subtype === "success") {
          resultText = message.result;
        } else {
          throw new Error(`La llamada a Claude terminó sin éxito (subtype="${message.subtype}").`);
        }
      }
    }
  } catch (error) {
    console.error(
      `[weekly-briefing] Error fatal llamando a Claude: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
    return;
  }

  if (!resultText.trim()) {
    console.error("[weekly-briefing] Error fatal: Claude no devolvió contenido.");
    process.exitCode = 1;
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  await mkdir(BRIEFINGS_DIR, { recursive: true });
  const outPath = path.join(BRIEFINGS_DIR, `${today}.md`);

  const header =
    `# Informe semanal — ${today}\n\n` +
    `Proyectos cubiertos (con actividad git detectada): ${projectsCovered.length > 0 ? projectsCovered.join(", ") : "(ninguno)"}\n\n` +
    `---\n\n`;

  await writeFile(outPath, header + resultText.trim() + "\n", "utf8");

  const durationMs = Date.now() - startedAt;
  console.log(`[weekly-briefing] Informe escrito en ${outPath} (${(durationMs / 1000).toFixed(1)}s).`);
}

main().catch((error) => {
  console.error("[weekly-briefing] Error fatal:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
