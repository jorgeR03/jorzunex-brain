import "dotenv/config";
import express from "express";
import cors from "cors";
import { askBrain } from "./gateway.js";
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
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: "Error interno al procesar la pregunta.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

app.listen(PORT, () => {
  process.stdout.write(`[brain-server] Escuchando en http://localhost:${PORT} (POST /ask, GET /health)\n`);
});
