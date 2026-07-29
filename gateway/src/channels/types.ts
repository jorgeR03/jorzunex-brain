/**
 * Interfaz `Channel` — contrato común para cualquier canal de entrada/salida
 * del Brain (CLI, web, Slack, WhatsApp, voz...).
 *
 * Diseñada desde la v1 para soportar audio (ver
 * docs/adr/ADR-0002-asistente-de-voz.md, "Impacto en el diseño", punto 1),
 * aunque en PoC-1 solo se implemente el canal CLI de texto. Ningún canal
 * futuro debería requerir cambiar esta interfaz para añadir voz — solo
 * implementarla.
 */

/** Modo de salida esperado por el canal. Determina el estilo de la respuesta. */
export type OutputMode = "voice" | "text";

/** Payload de entrada de un canal: texto y/o audio. */
export interface ChannelInputPayload {
  /** Texto de la pregunta/mensaje. Obligatorio si no hay audio (o ya transcrito). */
  text?: string;
  /**
   * Audio crudo (p. ej. nota de voz de WhatsApp) pendiente de transcribir.
   * En PoC-1 ningún canal lo rellena todavía — reservado para escalón B de
   * ADR-0002 (faster-whisper). El adaptador STT del canal debe convertirlo
   * a `text` antes de llegar al gateway.
   */
  audio?: {
    data: Buffer;
    mimeType: string;
  };
}

/** Payload de salida que el gateway entrega a un canal. */
export interface ChannelOutputPayload {
  /** Texto de la respuesta. Si `outputMode === "voice"`, debe ser apto para TTS
   * (frases cortas, sin Markdown/tablas — ver ADR-0002 punto 2). */
  text: string;
  /**
   * Audio sintetizado de la respuesta, cuando el canal soporta voz de
   * salida. Reservado para escalones B/C de ADR-0002 — ningún canal de
   * PoC-1 lo rellena.
   */
  audio?: {
    data: Buffer;
    mimeType: string;
  };
  /** Rutas de archivo citadas por el modelo al construir la respuesta. */
  citations: string[];
  /** Nombres de las herramientas del SDK usadas para responder. */
  toolsUsed: string[];
}

/** Contexto de una petición entrante, común a todos los canales. */
export interface ChannelRequest {
  channel: string; // 'cli' | 'web' | 'slack' | 'whatsapp' | ...
  outputMode: OutputMode;
  payload: ChannelInputPayload;
  /** Identificador de usuario/hilo, cuando el canal lo provea (Slack, WhatsApp, web). */
  userId?: string;
}

/**
 * Un `Channel` traduce entre su transporte nativo (stdin/stdout, webhook de
 * Slack/Twilio, WebSocket de la web UI...) y el núcleo del gateway. La
 * lógica de negocio (ModelRouter, persistencia, RAG) nunca debe conocer el
 * transporte concreto.
 */
export interface Channel {
  readonly name: string;
  readonly outputMode: OutputMode;

  /** Envía una petición ya normalizada al gateway y devuelve la respuesta. */
  handle(request: ChannelRequest): Promise<ChannelOutputPayload>;
}
