import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from "@xenova/transformers";
// El build ESM de wavefile solo expone un default export (interop de un
// paquete CJS) — WaveFile cuelga de ahí, no es un named export real.
import wavefile from "wavefile";
import type { SttEngine } from "./types.js";

const { WaveFile } = wavefile;

env.allowLocalModels = false;

const TARGET_SAMPLE_RATE = 16000;

/**
 * Motor de voz→texto local y gratuito (Whisper vía `@xenova/transformers`,
 * mismo enfoque CPU/sin API de pago que el Embedder — ver
 * docs/adr/ADR-0002-asistente-de-voz.md Escalón B, y ADR-0001 §3). Sustituye
 * a la Web Speech API del navegador (Escalón A) como motor PRINCIPAL de
 * reconocimiento: más robusto a hablar rápido/suave, que era la queja real
 * de Jorge ("no entiende o entiende otra cosa").
 *
 * Decodifica el WAV con `wavefile` en vez de `read_audio` del propio
 * paquete porque `read_audio` requiere `AudioContext`, que no existe en
 * Node — es la vía documentada oficialmente por transformers.js para audio
 * en servidor.
 */
export class WhisperSttEngine implements SttEngine {
  readonly modelName: string;
  private pipelinePromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

  constructor(modelName = "Xenova/whisper-base") {
    this.modelName = modelName;
  }

  private async getPipeline(): Promise<AutomaticSpeechRecognitionPipeline> {
    if (!this.pipelinePromise) {
      this.pipelinePromise = pipeline("automatic-speech-recognition", this.modelName);
    }
    return this.pipelinePromise;
  }

  async warmup(): Promise<void> {
    await this.getPipeline();
  }

  async transcribe(wav: Buffer): Promise<string> {
    const audioData = decodeWavToFloat32Mono16k(wav);
    const transcriber = await this.getPipeline();
    const output = await transcriber(audioData, { language: "spanish", task: "transcribe" });
    const result = Array.isArray(output) ? output[0] : output;
    return (result?.text ?? "").trim();
  }
}

/** Decodifica cualquier WAV (mono/estéreo, cualquier sample rate/bit depth) a Float32 mono a 16kHz, el formato que espera Whisper. */
function decodeWavToFloat32Mono16k(wav: Buffer): Float32Array {
  const file = new WaveFile(wav);
  file.toBitDepth("32f");
  file.toSampleRate(TARGET_SAMPLE_RATE);

  // El .d.ts de wavefile tipa getSamples() como Float64Array siempre, pero en
  // runtime devuelve lo que se le pida vía OutputObject (Float32Array aquí),
  // y un array de canales cuando el audio no es mono — de ahí el cast.
  let samples = file.getSamples(false, Float32Array) as unknown as Float32Array | Float32Array[];
  if (Array.isArray(samples)) {
    // Estéreo (u otro multicanal): down-mix a mono promediando canales.
    const [left, ...rest] = samples;
    if (rest.length === 0) {
      samples = left;
    } else {
      const mixed = new Float32Array(left.length);
      for (let i = 0; i < left.length; i++) {
        let sum = left[i];
        for (const channel of rest) sum += channel[i] ?? 0;
        mixed[i] = sum / samples.length;
      }
      samples = mixed;
    }
  }
  return samples;
}
