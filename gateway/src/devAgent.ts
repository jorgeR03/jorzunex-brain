import path from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { resolveModel } from "./modelRouter.js";

/**
 * Atlas en modo desarrollador: orquesta una sesión completa del Claude Agent
 * SDK (Read/Glob/Grep/Write/Edit/Bash) con el `cwd` puesto en uno de los
 * proyectos reales de JorZunex — no en este repo del Brain — para que pueda
 * modificar código de verdad, no solo leer.
 *
 * Guardarraíl no negociable (ver CLAUDE.md / ADR-0001 — "acciones
 * irreversibles → confirmación humana siempre"): cualquier comando de Bash
 * que huela a publicar/desplegar (git push, vercel deploy --prod, npm
 * publish, etc.) se BLOQUEA a nivel de `canUseTool` — no es una instrucción
 * en el prompt que el modelo podría ignorar, es un guardarraíl de código que
 * el modelo no puede saltarse. Se libera solo si `allowDeploy: true` viene
 * explícito en la petición (decisión humana por interacción, no un ajuste
 * permanente).
 */

const PROJECTS_ROOT = path.resolve(process.env.DEV_AGENT_PROJECTS_ROOT ?? "C:/Users/jorge/ProyectosJorZunex");

/** Esta carpeta es el propio Brain — no se auto-modifica en esta primera versión. */
const SELF_REPO_NAME = "Cerebro JorZunex";

const DANGEROUS_BASH_PATTERN =
  /\b(git\s+push|vercel\s+([\w-]+\s+)?(--prod|deploy)|railway\s+(up|deploy)|npm\s+publish|netlify\s+deploy\S*\s+--prod|fly\s+deploy|gh\s+release\s+create)\b/i;

export interface DevTaskOptions {
  /** Nombre exacto de la carpeta bajo ProyectosJorZunex (p. ej. "GymApp"). */
  project: string;
  instruction: string;
  /** Autoriza comandos de despliegue/publicación para ESTA petición únicamente. */
  allowDeploy?: boolean;
  /** Escala a claude-opus-5 para tareas de código especialmente difíciles. */
  allowOpus?: boolean;
  maxTurns?: number;
}

export interface DevTaskResult {
  ok: boolean;
  summary: string;
  model: string;
  filesChanged: string[];
  bashCommandsRun: string[];
  blockedCommands: string[];
  stopReason: string | null;
  isError: boolean;
  errorMessage?: string;
  durationMs: number;
}

export class DevAgentError extends Error {}

/** Valida y resuelve el path del proyecto, rechazando cualquier intento de
 * salirse de ProyectosJorZunex (path traversal) o de tocar el propio Brain. */
export function resolveProjectPath(project: string): string {
  const cleaned = project.trim();
  if (!cleaned || cleaned === "." || cleaned === "..") {
    throw new DevAgentError(`Nombre de proyecto inválido: "${project}".`);
  }
  if (cleaned.toLowerCase() === SELF_REPO_NAME.toLowerCase()) {
    throw new DevAgentError(
      `Por seguridad, esta primera versión de Atlas-dev no se modifica a sí misma (${SELF_REPO_NAME}). ` +
        `Pide este cambio directamente en una sesión normal de Claude Code sobre este repo.`,
    );
  }

  const resolved = path.resolve(PROJECTS_ROOT, cleaned);
  if (resolved !== PROJECTS_ROOT && !resolved.startsWith(PROJECTS_ROOT + path.sep)) {
    throw new DevAgentError(
      `Ruta resuelta ("${resolved}") queda fuera de ProyectosJorZunex — rechazada.`,
    );
  }
  if (resolved === PROJECTS_ROOT) {
    throw new DevAgentError("Debes indicar una carpeta de proyecto concreta, no la raíz.");
  }
  return resolved;
}

function extractToolPath(input: Record<string, unknown>): string | undefined {
  const raw = input.file_path ?? input.path;
  return typeof raw === "string" ? raw : undefined;
}

export async function runDevTask(opts: DevTaskOptions): Promise<DevTaskResult> {
  const startedAt = Date.now();
  const projectPath = resolveProjectPath(opts.project);

  const model = opts.allowOpus
    ? resolveModel({ task: "agentic", allowOpus: true })
    : resolveModel({ task: "default" });

  const filesChanged = new Set<string>();
  const bashCommandsRun: string[] = [];
  const blockedCommands: string[] = [];

  const systemPrompt = `Eres Atlas, operando en MODO DESARROLLADOR sobre el proyecto "${opts.project}" de JorZunex (carpeta: ${projectPath}).

Tienes acceso de lectura Y escritura (Read, Glob, Grep, Write, Edit, Bash) SOLO dentro de esta carpeta de proyecto. Haz exactamente lo que pide la instrucción del usuario, sin ampliar el alcance ni "aprovechar para mejorar" cosas que no se pidieron.

Reglas:
- Si necesitas ejecutar 'git push', desplegar (Vercel/Railway/Netlify/Fly), o publicar un paquete, y NO se te ha autorizado explícitamente, el sistema bloqueará ese comando automáticamente — no es un error tuyo. Cuando eso pase, detente ahí, no insistas, y en tu respuesta final dile al usuario exactamente qué comando quedó pendiente de aprobación y por qué.
- Cambios de código locales (editar archivos, correr tests, git add, git commit LOCAL) sí están permitidos sin pedir permiso adicional.
- Al terminar, resume en 3-6 frases: qué cambiaste, qué archivos tocaste, si corriste tests y su resultado, y qué queda pendiente (si algo quedó bloqueado por falta de autorización de despliegue).
- Responde en español. Nunca uses emojis.`;

  const stream = query({
    prompt: opts.instruction,
    options: {
      model,
      cwd: projectPath,
      systemPrompt,
      tools: ["Read", "Glob", "Grep", "Write", "Edit", "Bash"],
      // IMPORTANTE (bug real de seguridad detectado y corregido 2026-07-29):
      // `allowedTools` significa "auto-aprobado SIN pasar por canUseTool" —
      // NO es lo mismo que "tools" (qué herramientas existen). Poner Bash
      // aquí causó que un `git push` real se ejecutara sin pasar por el
      // guardarraíl de abajo. NO añadir Write/Edit/Bash a allowedTools:
      // deben decidirse SIEMPRE vía canUseTool, sin excepción.
      allowedTools: ["Read", "Glob", "Grep"],
      disallowedTools: ["WebFetch", "WebSearch", "NotebookEdit"],
      permissionMode: "default",
      settingSources: [],
      maxTurns: opts.maxTurns ?? 40,
      canUseTool: async (toolName, input) => {
        if (toolName === "Bash") {
          const command = String((input as Record<string, unknown>).command ?? "");
          if (DANGEROUS_BASH_PATTERN.test(command) && !opts.allowDeploy) {
            blockedCommands.push(command);
            return {
              behavior: "deny",
              message:
                "Comando de despliegue/publicación bloqueado por Atlas: requiere confirmación explícita " +
                "de Jorge (allowDeploy=true) para esta tarea. No lo ejecutes; informa en tu resumen final " +
                "que quedó pendiente de aprobación y cuál era el comando.",
            };
          }
          bashCommandsRun.push(command);
        }
        if (toolName === "Write" || toolName === "Edit") {
          const filePath = extractToolPath(input);
          if (filePath) filesChanged.add(filePath);
        }
        return { behavior: "allow" };
      },
    },
  });

  let summary = "";
  let stopReason: string | null = null;
  let isError = false;
  let errorMessage: string | undefined;

  try {
    for await (const message of stream) {
      if (message.type === "result") {
        stopReason = message.stop_reason ?? null;
        isError = message.is_error;
        if (message.subtype === "success") {
          summary = message.result;
        } else {
          errorMessage = `Ejecución detenida (${message.subtype}).`;
        }
      }
    }
  } catch (error) {
    isError = true;
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  return {
    ok: !isError,
    summary: summary || errorMessage || "(sin resumen)",
    model,
    filesChanged: Array.from(filesChanged),
    bashCommandsRun,
    blockedCommands,
    stopReason,
    isError,
    errorMessage,
    durationMs: Date.now() - startedAt,
  };
}
