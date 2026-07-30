import "dotenv/config";
import express from "express";
import cors from "cors";
import { askBrain } from "./gateway.js";
import { runDevTask, DevAgentError } from "./devAgent.js";
import { synthesizeSpeech, isTtsConfigured, loadTtsConfig, TtsNotConfiguredError } from "./tts/elevenlabs.js";
import type { TaskType } from "./modelRouter.js";
import type { OutputMode } from "./channels/types.js";

/**
 * Servidor HTTP mínimo del gateway — expone `askBrain` por HTTP para que
 * cualquier canal (web, y en el futuro Slack/WhatsApp) pueda hablarle al
 * Brain sin importar el código TypeScript del gateway directamente.
 *
 * NO tiene autenticación propia. Pensado para correr en localhost durante
 * desarrollo; si se expone fuera de la máquina (VPS/túnel), debe ir detrás
 * de un proxy con autenticación (ver docs/adr/ADR-0001 y la discusión de
 * Clerk/gate compartido antes de desplegar en remoto).
 */

const PORT = Number(process.env.GATEWAY_HTTP_PORT ?? 8787);

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

interface AskRequestBody {
  question?: string;
  channel?: string;
  outputMode?: OutputMode;
  task?: TaskType;
  allowOpus?: boolean;
  allowFable?: boolean;
  topK?: number;
  useRetrieval?: boolean;
  sessionId?: string;
}

app.post("/ask", async (req, res) => {
  const body = req.body as AskRequestBody;

  if (!body.question || typeof body.question !== "string" || !body.question.trim()) {
    res.status(400).json({ error: "El campo 'question' es obligatorio (string no vacío)." });
    return;
  }

  try {
    const result = await askBrain({
      question: body.question,
      channel: body.channel ?? "web",
      outputMode: body.outputMode ?? "text",
      task: body.task ?? "default",
      allowOpus: body.allowOpus ?? false,
      allowFable: body.allowFable ?? false,
      topK: body.topK,
      useRetrieval: body.useRetrieval,
      sessionId: body.sessionId,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: "Error interno al procesar la pregunta.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

interface DevTaskRequestBody {
  project?: string;
  instruction?: string;
  allowDeploy?: boolean;
  allowOpus?: boolean;
}

/**
 * Atlas en modo desarrollador: modifica código REAL de un proyecto bajo
 * ProyectosJorZunex (nunca este repo del Brain). Cualquier comando de
 * despliegue/publicación queda bloqueado salvo `allowDeploy: true` — ver
 * gateway/src/devAgent.ts para el guardarraíl completo. Sin autenticación
 * propia (igual que /ask): no exponer fuera de localhost sin un proxy con
 * login delante.
 */
app.post("/dev-task", async (req, res) => {
  const body = req.body as DevTaskRequestBody;

  if (!body.project || !body.project.trim()) {
    res.status(400).json({ error: "El campo 'project' es obligatorio." });
    return;
  }
  if (!body.instruction || !body.instruction.trim()) {
    res.status(400).json({ error: "El campo 'instruction' es obligatorio." });
    return;
  }

  try {
    const result = await runDevTask({
      project: body.project,
      instruction: body.instruction,
      allowDeploy: body.allowDeploy ?? false,
      allowOpus: body.allowOpus ?? false,
    });
    res.json(result);
  } catch (error) {
    if (error instanceof DevAgentError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({
      error: "Error interno al ejecutar la tarea de desarrollo.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

interface TtsRequestBody {
  text?: string;
}

/**
 * Voz de alta calidad (ElevenLabs, ADR-0002 escalón C). Devuelve 501 si
 * ELEVENLABS_API_KEY/ELEVENLABS_VOICE_ID no están configurados en
 * gateway/.env — el canal (web) debe capturar ese caso y usar la voz del
 * navegador como respaldo automático, sin mostrarle un error al usuario.
 */
app.get("/tts/status", (_req, res) => {
  res.json({ configured: isTtsConfigured(loadTtsConfig()) });
});

app.post("/tts", async (req, res) => {
  const body = req.body as TtsRequestBody;

  if (!body.text || !body.text.trim()) {
    res.status(400).json({ error: "El campo 'text' es obligatorio." });
    return;
  }

  try {
    const audio = await synthesizeSpeech(body.text);
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audio);
  } catch (error) {
    if (error instanceof TtsNotConfiguredError) {
      res.status(501).json({ error: error.message, fallback: "browser" });
      return;
    }
    res.status(502).json({
      error: "Error al sintetizar voz con ElevenLabs.",
      detail: error instanceof Error ? error.message : String(error),
      fallback: "browser",
    });
  }
});

app.listen(PORT, () => {
  process.stdout.write(
    `[brain-server] Escuchando en http://localhost:${PORT} (POST /ask, POST /dev-task, POST /tts, GET /health)\n`,
  );
});
