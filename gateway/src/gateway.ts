import path from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { REPO_ROOT, loadConfig } from "./config.js";
import { resolveModel, estimateCostUsd, type TaskType } from "./modelRouter.js";
import { createConversationStore } from "./persistence/index.js";
import type { ConversationRecord } from "./persistence/types.js";
import type { OutputMode } from "./channels/types.js";

/** Herramientas de solo lectura permitidas al Brain: nunca Write/Edit/Bash. */
const READ_ONLY_TOOLS = ["Read", "Glob", "Grep"] as const;

const KNOWLEDGE_SYSTEM_PROMPT = `Eres el Brain de JorZunex, el asistente interno de la empresa.

Tu conocimiento son EXCLUSIVAMENTE los archivos Markdown dentro de las carpetas
"docs/" y "prompts/" de este repositorio (investigación, ADRs, visión, wiki y
prompts versionados). Tienes acceso de SOLO LECTURA (Read, Glob, Grep) — no
puedes ni debes intentar modificar, crear ni borrar nada.

Reglas de respuesta:
- Responde SIEMPRE en español, con precisión y sin inventar información que
  no esté en esos documentos.
- Cita explícitamente el/los archivo(s) de los que sacaste la respuesta
  (ruta relativa, p. ej. "docs/adr/ADR-0001-decisiones-fundacionales.md").
- Si la pregunta no se puede responder con el contenido de docs/ o prompts/,
  dilo claramente en vez de inventar.
- No leas ni cites archivos fuera de docs/ o prompts/.`;

const VOICE_SUFFIX =
  "\n\nModo de salida: VOZ. Responde en frases cortas, sin Markdown, sin tablas ni listas con viñetas — texto plano apto para síntesis de voz (TTS).";

export interface AskBrainOptions {
  question: string;
  channel: string;
  outputMode?: OutputMode;
  task?: TaskType;
  allowOpus?: boolean;
  allowFable?: boolean;
  maxTurns?: number;
}

export interface AskBrainResult {
  answer: string;
  model: string;
  toolsUsed: string[];
  citations: string[];
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  estimatedCostUsd: number;
  stopReason: string | null;
  isError: boolean;
  errorMessage?: string;
  durationMs: number;
  refusal: boolean;
}

function extractFilePath(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const record = input as Record<string, unknown>;
  const raw = record.file_path ?? record.path ?? record.pattern;
  if (typeof raw !== "string") return undefined;
  // Normaliza a ruta relativa al repo cuando es posible, para citas legibles.
  const relative = path.isAbsolute(raw) ? path.relative(REPO_ROOT, raw) : raw;
  return relative.replace(/\\/g, "/");
}

/**
 * Núcleo del gateway: responde una pregunta usando el Claude Agent SDK con
 * acceso de solo lectura a docs/ y prompts/, y persiste la interacción
 * completa (Postgres o JSONL, según disponibilidad).
 */
export async function askBrain(options: AskBrainOptions): Promise<AskBrainResult> {
  const config = loadConfig();
  const startedAt = Date.now();

  const model = resolveModel({
    task: options.task ?? "default",
    allowOpus: options.allowOpus,
    allowFable: options.allowFable,
  });

  const outputMode: OutputMode = options.outputMode ?? "text";
  const systemPrompt = KNOWLEDGE_SYSTEM_PROMPT + (outputMode === "voice" ? VOICE_SUFFIX : "");

  const toolsUsed = new Set<string>();
  const citations = new Set<string>();

  let answer = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  let estimatedCostUsd = 0;
  let stopReason: string | null = null;
  let isError = false;
  let errorMessage: string | undefined;
  let refusal = false;

  try {
    const stream = query({
      prompt: options.question,
      options: {
        model,
        cwd: REPO_ROOT,
        systemPrompt,
        tools: [...READ_ONLY_TOOLS],
        allowedTools: [...READ_ONLY_TOOLS],
        disallowedTools: ["Write", "Edit", "Bash", "WebFetch", "WebSearch", "NotebookEdit"],
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        // Aísla la sesión de CLAUDE.md / settings de usuario y proyecto: el
        // conocimiento del Brain debe salir SOLO de Read/Glob/Grep sobre
        // docs/ y prompts/, no de contexto auto-cargado fuera de esas rutas.
        settingSources: [],
        maxTurns: options.maxTurns ?? 15,
      },
    });

    for await (const message of stream) {
      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "tool_use") {
            toolsUsed.add(block.name);
            const cited = extractFilePath(block.input);
            if (cited) citations.add(cited);
          }
        }
      } else if (message.type === "result") {
        stopReason = message.stop_reason;
        isError = message.is_error;
        inputTokens = message.usage.input_tokens ?? 0;
        outputTokens = message.usage.output_tokens ?? 0;
        cacheReadTokens = message.usage.cache_read_input_tokens ?? 0;
        cacheWriteTokens = message.usage.cache_creation_input_tokens ?? 0;
        estimatedCostUsd = message.total_cost_usd ?? estimateCostUsd(model, inputTokens, outputTokens);

        if (message.subtype === "success") {
          answer = message.result;
        } else {
          errorMessage = `Ejecución detenida (${message.subtype}).`;
        }
      }
    }
  } catch (error) {
    isError = true;
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  // Manejo explícito de stop_reason "refusal": mensaje claro al usuario en
  // vez de devolver una respuesta vacía o un error técnico críptico.
  if (stopReason === "refusal") {
    refusal = true;
    answer =
      "El modelo ha rechazado esta petición por motivos de seguridad/políticas " +
      "(stop_reason: refusal). No es un fallo técnico: reformula la pregunta o " +
      "consulta a Jorge si crees que es un falso positivo.";
  } else if (isError && !answer) {
    answer = `Error al generar la respuesta${errorMessage ? `: ${errorMessage}` : "."}`;
  }

  const durationMs = Date.now() - startedAt;

  const record: ConversationRecord = {
    createdAt: new Date(startedAt).toISOString(),
    channel: options.channel,
    taskType: options.task ?? "default",
    model,
    question: options.question,
    answer,
    toolsUsed: Array.from(toolsUsed),
    citations: Array.from(citations),
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    estimatedCostUsd,
    stopReason: stopReason ?? undefined,
    isError,
    errorMessage,
    durationMs,
    metadata: { outputMode, refusal },
  };

  const store = await createConversationStore(config);
  try {
    await store.save(record);
  } catch (persistError) {
    // La persistencia nunca debe romper la respuesta al usuario.
    process.stderr.write(
      `[brain] Aviso: no se pudo guardar la interacción (${
        persistError instanceof Error ? persistError.message : String(persistError)
      })\n`,
    );
  } finally {
    await store.close().catch(() => undefined);
  }

  return {
    answer,
    model,
    toolsUsed: Array.from(toolsUsed),
    citations: Array.from(citations),
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    estimatedCostUsd,
    stopReason,
    isError,
    errorMessage,
    durationMs,
    refusal,
  };
}
