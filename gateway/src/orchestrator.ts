import fs from "node:fs";
import path from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { resolveModel } from "./modelRouter.js";
import { REPO_ROOT, loadConfig } from "./config.js";
import { askBrain, type AskBrainOptions } from "./gateway.js";
import { runDevTask, resolveProjectPath, type DevTaskResult } from "./devAgent.js";
import { createRetriever } from "./retriever/index.js";
import { createJob, updateJob } from "./devJobs.js";

/**
 * Atlas Orchestrator (ADR-0003, paso 1 del "Orden de construcción"): un solo
 * punto de entrada conversacional que decide si la petición es una PREGUNTA
 * (askBrain, solo lectura) o una TAREA DE DESARROLLO (devAgent, escribe
 * código real) — el canal (web, futuro móvil/WhatsApp) no elige el modo, le
 * habla a Atlas y Atlas decide.
 *
 * Guardarraíl deliberado: el orquestador NUNCA autoriza despliegue/publicación
 * (`allowDeploy` siempre false aquí). Ese incidente real (ver ADR-0003,
 * sección "Incidente que motiva parte de este diseño") solo se corrige si
 * el permiso de desplegar sigue exigiendo la llamada directa a POST
 * /dev-task con el flag explícito — nunca algo que un clasificador
 * automático pueda conceder por sí solo.
 */

const PROJECTS_ROOT = path.resolve(process.env.DEV_AGENT_PROJECTS_ROOT ?? "C:/Users/jorge/ProyectosJorZunex");
const SELF_REPO_NAME = "Cerebro JorZunex";

export type AtlasCapability = "ask" | "dev_task" | "dev_task_unresolved";

export interface AtlasOptions extends AskBrainOptions {
  /** Si true, clasifica y resuelve la tarea de desarrollo pero NO la ejecuta — para pruebas seguras. */
  dryRun?: boolean;
  /**
   * Alternativas de transcripción del respaldo de navegador (Web Speech
   * API) cuando Whisper no estaba disponible — ver `resolveTranscript()`.
   * Si viene más de una, se usa un modelo barato para elegir/corregir la
   * más coherente antes de clasificar la intención. Ausente cuando la
   * pregunta ya viene de Whisper (transcripción única y más confiable).
   */
  asrAlternatives?: string[];
}

export interface AtlasResult {
  capability: AtlasCapability;
  answer: string;
  model: string;
  citations: string[];
  sessionId?: string;
  isError: boolean;
  durationMs: number;
  /** "running" cuando la tarea de desarrollo se lanzó en segundo plano — consultar `jobId` en GET /atlas/jobs/:id. Ausente en respuestas síncronas (ask, dryRun, dev_task_unresolved). */
  status?: "running";
  jobId?: string;
  /** Presente solo si capability es "dev_task" o "dev_task_unresolved". */
  devTask?: {
    project: string;
    instruction: string;
    filesChanged: string[];
    blockedCommands: string[];
    dryRun: boolean;
  };
}

interface IntentClassification {
  capability: "ask" | "dev_task";
  project: string | null;
  instruction: string | null;
}

function listRealProjects(): string[] {
  try {
    return fs
      .readdirSync(PROJECTS_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== SELF_REPO_NAME && !entry.name.startsWith("."))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function parseJsonLoose(text: string): unknown {
  const cleaned = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned);
}

/** Clasifica la intención del usuario con un modelo barato (Haiku, tarea "route" del ModelRouter). */
async function classifyIntent(question: string, projects: string[]): Promise<IntentClassification> {
  const model = resolveModel({ task: "route" });

  const systemPrompt = `Clasificas mensajes dirigidos a Atlas, el asistente interno de JorZunex. Responde EXCLUSIVAMENTE con un JSON válido (sin texto adicional, sin markdown) con esta forma exacta:
{"capability":"ask"|"dev_task","project":"<nombre exacto de carpeta o null>","instruction":"<instrucción reformulada o null>"}

Reglas:
- "dev_task" SOLO si el usuario pide explícitamente crear/modificar/arreglar código, archivos o configuración de un proyecto real y nombra (o deja clarísimo) cuál.
- Proyectos reales válidos (usa el nombre EXACTO de esta lista, o null si ninguno coincide claramente): ${projects.join(", ")}
- Cualquier otra cosa (preguntas, pedir información, conversación general, saludos) es "ask".
- Ante la duda, responde "ask" — es la opción segura, nunca ejecuta cambios.
- No incluyas explicaciones ni comentarios, solo el JSON.`;

  const stream = query({
    prompt: question,
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

  let raw = "";
  for await (const message of stream) {
    if (message.type === "result" && message.subtype === "success") {
      raw = message.result;
    }
  }

  try {
    const parsed = parseJsonLoose(raw) as Partial<IntentClassification>;
    if (
      parsed.capability === "dev_task" &&
      typeof parsed.project === "string" &&
      typeof parsed.instruction === "string"
    ) {
      return { capability: "dev_task", project: parsed.project, instruction: parsed.instruction };
    }
  } catch {
    // JSON inválido o inesperado: cae al fallback seguro de abajo.
  }
  return { capability: "ask", project: null, instruction: null };
}

/**
 * Cuando el canal cae al respaldo de navegador (Web Speech API, ver
 * page.tsx) y este dio varias alternativas de transcripción, corrige/elige
 * la más coherente con una llamada barata a Haiku, informada por los
 * nombres reales de proyecto — ayuda sobre todo con vocabulario de dominio
 * ("GymApp", "Zentrax") que el navegador suele priorizar mal. Si Whisper ya
 * dio una única transcripción (sin alternativas), esto es un no-op.
 *
 * Límite honesto (ya explicado a Jorge): esto solo puede elegir ENTRE las
 * alternativas que dio el navegador — si ninguna captó bien el audio, no
 * hay corrección posible. Para eso está Whisper como motor principal.
 */
async function resolveTranscript(
  question: string,
  alternatives: string[] | undefined,
  projects: string[],
): Promise<string> {
  if (!alternatives || alternatives.length <= 1) return question;
  const model = resolveModel({ task: "route" });

  const systemPrompt = `El reconocimiento de voz del navegador dio varias transcripciones alternativas de lo mismo que dijo un usuario, de más a menos probable. Elige o corrige la que tenga más sentido como una frase en español dirigida a Atlas, el asistente de IA interno de JorZunex. Nombres de proyectos reales que pueden aparecer (prioriza reconocerlos si alguna alternativa se les parece): ${projects.join(", ")}.

Responde EXCLUSIVAMENTE con la transcripción final corregida, sin comillas, sin explicaciones, sin markdown.`;

  const stream = query({
    prompt: alternatives.map((alt, i) => `${i + 1}. ${alt}`).join("\n"),
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

  let corrected = "";
  for await (const message of stream) {
    if (message.type === "result" && message.subtype === "success") {
      corrected = message.result.trim();
    }
  }
  return corrected || question;
}

export async function orchestrateAtlas(rawOptions: AtlasOptions): Promise<AtlasResult> {
  const startedAt = Date.now();
  const routeModel = resolveModel({ task: "route" });
  const projects = listRealProjects();

  const question = await resolveTranscript(rawOptions.question, rawOptions.asrAlternatives, projects);
  const options: AtlasOptions = question === rawOptions.question ? rawOptions : { ...rawOptions, question };

  const intent =
    projects.length > 0
      ? await classifyIntent(question, projects)
      : ({ capability: "ask", project: null, instruction: null } as const);

  if (intent.capability === "ask" || !intent.project || !intent.instruction) {
    const result = await askBrain(options);
    return {
      capability: "ask",
      answer: result.answer,
      model: result.model,
      citations: result.citations,
      sessionId: result.sessionId,
      isError: result.isError,
      durationMs: Date.now() - startedAt,
    };
  }

  // Reutiliza el mismo guardarraíl de ruta que devAgent.ts (rechaza path
  // traversal y proteje al propio repo del Brain de auto-modificarse).
  try {
    resolveProjectPath(intent.project);
  } catch (error) {
    return {
      capability: "dev_task_unresolved",
      answer:
        `Detecté una posible tarea de desarrollo ("${intent.instruction}") pero no pude resolver ` +
        `el proyecto "${intent.project}": ${error instanceof Error ? error.message : String(error)}. ` +
        `Dime el nombre exacto de la carpeta del proyecto.`,
      model: routeModel,
      citations: [],
      isError: true,
      durationMs: Date.now() - startedAt,
      devTask: {
        project: intent.project,
        instruction: intent.instruction,
        filesChanged: [],
        blockedCommands: [],
        dryRun: Boolean(options.dryRun),
      },
    };
  }

  if (options.dryRun) {
    return {
      capability: "dev_task",
      answer:
        `[dryRun] Ejecutaría el modo desarrollador sobre "${intent.project}" con la instrucción: ` +
        `"${intent.instruction}". No se modificó ningún archivo.`,
      model: routeModel,
      citations: [],
      isError: false,
      durationMs: Date.now() - startedAt,
      devTask: {
        project: intent.project,
        instruction: intent.instruction,
        filesChanged: [],
        blockedCommands: [],
        dryRun: true,
      },
    };
  }

  // Recupera contexto relevante del cerebro (mismo Retriever que askBrain)
  // ANTES de ejecutar — sin esto, devAgent arrancaba sin saber nada de lo
  // que el resto del sistema ya sabe de este proyecto.
  const contextNote = await retrieveContextForDevTask(intent.instruction);

  const project = intent.project;
  const instruction = intent.instruction;
  const job = createJob(project, instruction);

  // Se lanza SIN esperar — el orquestador responde de inmediato con el
  // jobId y el canal (web) hace polling. Así la conversación no se queda
  // bloqueada los 30-90s+ que puede tardar una tarea de desarrollo real.
  void (async () => {
    try {
      const devResult: DevTaskResult = await runDevTask({
        project,
        instruction,
        allowDeploy: false,
        allowOpus: options.allowOpus,
        contextNote,
      });
      await appendDevActivityLog(project, instruction, devResult);
      updateJob(job.id, {
        status: devResult.isError ? "error" : "done",
        finishedAt: Date.now(),
        answer: devResult.summary,
        model: devResult.model,
        filesChanged: devResult.filesChanged,
        blockedCommands: devResult.blockedCommands,
        errorMessage: devResult.errorMessage,
      });
    } catch (error) {
      updateJob(job.id, {
        status: "error",
        finishedAt: Date.now(),
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  })();

  return {
    capability: "dev_task",
    status: "running",
    jobId: job.id,
    answer:
      `Entendido — voy a trabajar en segundo plano sobre "${project}": ${instruction}. ` +
      `Te aviso cuando termine.`,
    model: routeModel,
    citations: [],
    isError: false,
    durationMs: Date.now() - startedAt,
    devTask: { project, instruction, filesChanged: [], blockedCommands: [], dryRun: false },
  };
}

/** Best-effort: si el Retriever no está disponible, devAgent arranca sin contexto extra (igual que antes). */
async function retrieveContextForDevTask(instruction: string): Promise<string | undefined> {
  const config = loadConfig();
  const retriever = await createRetriever(config);
  if (!retriever) return undefined;
  try {
    const chunks = await retriever.retrieve(instruction, 6);
    if (chunks.length === 0) return undefined;
    return chunks
      .map((chunk) => `[${chunk.sourcePath} #${chunk.chunkIndex}]\n${chunk.content}`)
      .join("\n\n");
  } catch {
    return undefined;
  } finally {
    await retriever.close().catch(() => undefined);
  }
}

const DEV_ACTIVITY_LOG_DIR = path.join(REPO_ROOT, "docs", "wiki", "proyectos", "_actividad-dev");

/**
 * Anota cada tarea de desarrollo ejecutada en un Markdown dedicado dentro de
 * ESTE repo (nunca dentro del proyecto externo real — no se ensucia código
 * ajeno con archivos que Jorge no pidió). Vive bajo docs/, que el watcher
 * de ingesta (gateway/src/ingest/watch.ts) YA vigila — se re-ingesta solo,
 * así la próxima pregunta sobre este proyecto puede citar este historial
 * como cualquier otro documento de la wiki. Esta es la memoria compartida
 * real (consultable por RAG), a diferencia de la tabla `conversations`
 * (Postgres), que el Retriever no lee.
 */
async function appendDevActivityLog(
  project: string,
  instruction: string,
  devResult: DevTaskResult,
): Promise<void> {
  try {
    await fs.promises.mkdir(DEV_ACTIVITY_LOG_DIR, { recursive: true });
    const filePath = path.join(DEV_ACTIVITY_LOG_DIR, `${project}.md`);
    const entry = `## ${new Date().toISOString()} — ${instruction}

- Resultado: ${devResult.isError ? "ERROR" : "OK"}
- Resumen: ${devResult.summary}
- Archivos modificados: ${devResult.filesChanged.join(", ") || "(ninguno)"}
- Comandos bloqueados: ${devResult.blockedCommands.join(", ") || "(ninguno)"}

---

`;
    await fs.promises.appendFile(filePath, entry, "utf8");
  } catch (error) {
    process.stderr.write(
      `[orchestrator] Aviso: no se pudo escribir el log de actividad de "${project}" (${
        error instanceof Error ? error.message : String(error)
      })\n`,
    );
  }
}
