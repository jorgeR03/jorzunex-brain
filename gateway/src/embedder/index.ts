import { TransformersEmbedder } from "./transformersEmbedder.js";
import type { Embedder } from "./types.js";

export type { Embedder } from "./types.js";

let cached: Embedder | null = null;

/**
 * Factory del Embedder por defecto del proyecto. Singleton de proceso: el
 * modelo tarda unos segundos en cargar/descargar la primera vez, así que se
 * reutiliza la misma instancia dentro de un mismo proceso (ingesta o CLI).
 */
export function getDefaultEmbedder(): Embedder {
  if (!cached) {
    const modelName = process.env.BRAIN_EMBEDDING_MODEL ?? "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
    const dimension = Number(process.env.BRAIN_EMBEDDING_DIM ?? 384);
    cached = new TransformersEmbedder(modelName, dimension);
  }
  return cached;
}
