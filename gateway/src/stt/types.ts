/**
 * Interfaz `SttEngine` — motor de reconocimiento de voz (voz→texto) local.
 * Mismo espíritu que `Embedder` (gateway/src/embedder/): un adaptador
 * intercambiable, nunca hablado directamente desde server.ts/orchestrator.ts.
 */
export interface SttEngine {
  readonly modelName: string;
  /** Transcribe un WAV (cualquier sample rate/bit depth/canales) a texto en español. */
  transcribe(wav: Buffer): Promise<string>;
  /** Fuerza la carga del modelo antes del primer audio real (evita el retraso en la primera petición). */
  warmup(): Promise<void>;
}
