import { WhisperSttEngine } from "./whisperEngine.js";
import type { SttEngine } from "./types.js";

export type { SttEngine } from "./types.js";

let cached: SttEngine | null = null;

/**
 * Factory del SttEngine por defecto del proyecto. Singleton de proceso —
 * mismo motivo que getDefaultEmbedder(): el modelo tarda en cargar/descargar
 * la primera vez, se reutiliza la instancia dentro de un mismo proceso.
 * Modelo configurable vía BRAIN_STT_MODEL (por defecto Xenova/whisper-base,
 * balance velocidad/calidad en CPU; Xenova/whisper-small si hace falta más
 * calidad y se acepta más latencia).
 */
export function getDefaultSttEngine(): SttEngine {
  if (!cached) {
    const modelName = process.env.BRAIN_STT_MODEL ?? "Xenova/whisper-base";
    cached = new WhisperSttEngine(modelName);
  }
  return cached;
}
