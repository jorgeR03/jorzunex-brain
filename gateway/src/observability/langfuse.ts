import { Langfuse } from "langfuse";
import type { BrainConfig } from "../config.js";
import type { AskBrainOptions, AskBrainResult } from "../gateway.js";

let client: Langfuse | null = null;
let clientConfigured = false;

/**
 * Crea (una sola vez) el cliente de Langfuse si hay credenciales configuradas.
 * Si `LANGFUSE_PUBLIC_KEY`/`LANGFUSE_SECRET_KEY` no están definidas, la
 * integración queda desactivada silenciosamente — nunca debe romper el
 * gateway por falta de observabilidad (mismo principio que la persistencia).
 */
function getClient(config: BrainConfig): Langfuse | null {
  if (clientConfigured) return client;
  clientConfigured = true;

  const { publicKey, secretKey, baseUrl } = config.langfuse;
  if (!publicKey || !secretKey) {
    return null;
  }

  client = new Langfuse({ publicKey, secretKey, baseUrl });
  return client;
}

/**
 * Registra una interacción completa de `askBrain` como una traza de Langfuse
 * (trace -> generation), con el mismo detalle que ya se persiste en
 * Postgres/JSONL: modelo, tokens, coste, herramientas usadas, citas y si
 * hubo recuperación RAG. Best-effort: cualquier fallo se registra en stderr
 * y nunca se propaga — la observabilidad no debe afectar la respuesta.
 */
export async function traceAskBrain(
  config: BrainConfig,
  options: AskBrainOptions,
  result: AskBrainResult,
): Promise<void> {
  const langfuse = getClient(config);
  if (!langfuse) return;

  try {
    const trace = langfuse.trace({
      name: "brain.ask",
      input: options.question,
      output: result.answer,
      tags: [options.channel, options.task ?? "default", options.outputMode ?? "text"],
      metadata: {
        retrievalUsed: result.retrievalUsed,
        retrievedChunks: result.retrievedChunks,
        toolsUsed: result.toolsUsed,
        citations: result.citations,
        refusal: result.refusal,
        stopReason: result.stopReason,
      },
    });

    trace.generation({
      name: "brain.ask.generation",
      model: result.model,
      input: options.question,
      output: result.answer,
      usage: {
        input: result.inputTokens,
        output: result.outputTokens,
        unit: "TOKENS",
      },
      metadata: {
        cacheReadTokens: result.cacheReadTokens,
        cacheWriteTokens: result.cacheWriteTokens,
        estimatedCostUsd: result.estimatedCostUsd,
        durationMs: result.durationMs,
      },
      level: result.isError ? "ERROR" : "DEFAULT",
      statusMessage: result.errorMessage,
    });

    // No bloquea la respuesta al usuario; el flush ocurre en segundo plano
    // (Langfuse hace batching interno). Se puede forzar con flushLangfuse().
    langfuse.flushAsync().catch((error) => {
      process.stderr.write(
        `[brain] Aviso: no se pudo enviar la traza a Langfuse (${
          error instanceof Error ? error.message : String(error)
        })\n`,
      );
    });
  } catch (error) {
    process.stderr.write(
      `[brain] Aviso: fallo al construir la traza de Langfuse (${
        error instanceof Error ? error.message : String(error)
      }). Se continúa sin observabilidad para esta interacción.\n`,
    );
  }
}
