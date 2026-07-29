import { pipeline, env, type FeatureExtractionPipeline } from "@xenova/transformers";
import type { Embedder } from "./types.js";

// Evita que transformers.js intente acceder a modelos locales fuera de su
// caché gestionada (comportamiento por defecto de la librería). Los pesos
// del modelo se descargan una vez desde el Hub de Hugging Face (gratis, sin
// API key) y quedan cacheados para ejecuciones futuras.
env.allowLocalModels = false;

/**
 * Embedder local y gratuito basado en `@xenova/transformers` (transformers.js):
 * corre en CPU, sin llamadas a ninguna API externa de pago. Modelo por
 * defecto: `Xenova/paraphrase-multilingual-MiniLM-L12-v2` — soporta español
 * (y ~50 idiomas más), 384 dimensiones, adecuado para RAG de bajo coste.
 *
 * Ver docs/adr/ADR-0001-decisiones-fundacionales.md §3: nada de proveedores
 * de pago (OpenAI/Voyage) para embeddings en esta fase.
 */
export class TransformersEmbedder implements Embedder {
  readonly dimension: number;
  readonly modelName: string;

  private extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

  constructor(modelName = "Xenova/paraphrase-multilingual-MiniLM-L12-v2", dimension = 384) {
    this.modelName = modelName;
    this.dimension = dimension;
  }

  private async getExtractor(): Promise<FeatureExtractionPipeline> {
    if (!this.extractorPromise) {
      this.extractorPromise = pipeline("feature-extraction", this.modelName);
    }
    return this.extractorPromise;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const extractor = await this.getExtractor();
    const vectors: number[][] = [];

    // Secuencial (no en batch): el corpus de docs/+prompts/ es pequeño para
    // PoC-2 y así evitamos picos de memoria/complejidad de formas de tensor
    // en batch. Suficiente para este volumen; optimizar si el corpus crece.
    for (const text of texts) {
      const output = await extractor(text, { pooling: "mean", normalize: true });
      const [vector] = output.tolist() as number[][];
      if (!vector || vector.length !== this.dimension) {
        throw new Error(
          `TransformersEmbedder: se esperaban vectores de ${this.dimension} dimensiones, ` +
            `el modelo "${this.modelName}" devolvió ${vector?.length ?? "undefined"}.`,
        );
      }
      vectors.push(vector);
    }

    return vectors;
  }
}
