/**
 * Síntesis de voz de alta calidad vía ElevenLabs (ADR-0002 escalón C) —
 * capa gratuita real (10.000 caracteres/mes). Opcional y best-effort, mismo
 * principio que Langfuse: si no está configurado o falla, el llamador debe
 * caer de vuelta a la voz del navegador sin romper nada.
 *
 * Requiere en gateway/.env:
 *   ELEVENLABS_API_KEY   — tu API key (Settings → API Keys en elevenlabs.io;
 *                          necesita permisos "text_to_speech" como mínimo)
 *   ELEVENLABS_VOICE_ID  — el ID de una voz de TU cuenta ("My Voices"), no
 *                          de la librería compartida: el plan gratuito
 *                          bloquea la librería vía API (verificado: 402
 *                          "Free users cannot use library voices via the API").
 */

const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const DEFAULT_MODEL = "eleven_multilingual_v2"; // soporta español con buena calidad

export interface TtsConfig {
  apiKey?: string;
  voiceId?: string;
}

export function loadTtsConfig(): TtsConfig {
  return {
    apiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: process.env.ELEVENLABS_VOICE_ID,
  };
}

export function isTtsConfigured(config: TtsConfig): boolean {
  return Boolean(config.apiKey && config.voiceId);
}

export class TtsNotConfiguredError extends Error {
  constructor() {
    super(
      "ElevenLabs no está configurado (falta ELEVENLABS_API_KEY y/o ELEVENLABS_VOICE_ID en gateway/.env). " +
        "El canal debe caer de vuelta a la voz del navegador.",
    );
  }
}

/**
 * Nº de reintentos ante fallos transitorios (429 rate-limit del plan
 * gratuito, o 5xx puntuales) antes de rendirse — observado en uso real:
 * ráfagas de conversación (turnos seguidos, interrupciones) a veces topan
 * con el límite de concurrencia de la cuenta gratuita de ElevenLabs, y un
 * solo reintento corto basta para recuperarse sin caer a la voz del
 * navegador (que suena claramente peor y es un salto de calidad brusco).
 */
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 400;

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sintetiza `text` como audio MP3 real. Lanza TtsNotConfiguredError si
 * faltan credenciales (el llamador debe capturarla y usar el fallback del
 * navegador, no mostrar un error al usuario). Reintenta fallos transitorios
 * (ver MAX_RETRIES); cualquier otro fallo de la API de ElevenLabs se
 * propaga con el detalle devuelto por ellos.
 */
export async function synthesizeSpeech(text: string, config: TtsConfig = loadTtsConfig()): Promise<Buffer> {
  if (!isTtsConfigured(config)) {
    throw new TtsNotConfiguredError();
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS);

    const response = await fetch(`${ELEVENLABS_TTS_URL}/${config.voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": config.apiKey!,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: DEFAULT_MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    const detail = await response.text().catch(() => "");
    lastError = new Error(`ElevenLabs respondió ${response.status}: ${detail.slice(0, 300)}`);
    if (!isRetryableStatus(response.status)) throw lastError;
  }

  throw lastError ?? new Error("ElevenLabs: fallo desconocido tras reintentos.");
}
