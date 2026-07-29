/**
 * Interfaz `Embedder` — única puerta de entrada para convertir texto en
 * vectores. La implementación actual (`transformersEmbedder.ts`) usa un
 * modelo local gratuito vía `@xenova/transformers` (CPU, sin API externa,
 * sin coste — ver docs/adr/ADR-0001-decisiones-fundacionales.md §3:
 * presupuesto bajo, nada de proveedores de pago para esto). Ningún
 * consumidor (ingesta, Retriever) debe importar `@xenova/transformers`
 * directamente ni asumir qué modelo hay detrás — solo esta interfaz, para
 * poder cambiar de modelo/proveedor después sin tocar el resto.
 */
export interface Embedder {
  /** Dimensión de los vectores que produce este embedder (fija por modelo). */
  readonly dimension: number;
  /** Nombre/identificador del modelo, solo para logging/metadata. */
  readonly modelName: string;
  /** Embebe un lote de textos. Debe devolver un vector por texto, en el mismo orden. */
  embed(texts: string[]): Promise<number[][]>;
}
