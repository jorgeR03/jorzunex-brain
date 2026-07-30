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
 * Sintetiza `text` como audio MP3 real. Lanza TtsNotConfiguredError si
 * faltan credenciales (el llamador debe capturarla y usar el fallback del
 * navegador, no mostrar un error al usuario). Cualquier otro fallo de la
 * API de ElevenLabs se propaga con el detalle devuelto por ellos.
 */
export async function synthesizeSpeech(text: string, config: TtsConfig = loadTtsConfig()): Promise<Buffer> {
  if (!isTtsConfigured(config)) {
    throw new TtsNotConfiguredError();
  }

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

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`ElevenLabs respondió ${response.status}: ${detail.slice(0, 300)}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
