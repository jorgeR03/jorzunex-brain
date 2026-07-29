#!/usr/bin/env node
import { askBrain } from "./gateway.js";
import type { TaskType } from "./modelRouter.js";
import type { OutputMode } from "./channels/types.js";

function printUsage(): void {
  console.log(`Uso: brain ask "<pregunta>" [opciones]

Opciones:
  --voice           Responde en modo voz (frases cortas, sin Markdown).
  --task <tipo>     Tarea para el ModelRouter: default|classify|route|extract|bulk|agentic|critical
  --allow-opus      Autoriza claude-opus-5 cuando --task agentic (ADR-0001 §3).
  --allow-fable     Autoriza claude-fable-5 cuando --task critical (DESACTIVADO por defecto).
  --channel <nombre> Canal de origen (por defecto: "cli").

Ejemplos:
  brain ask "¿Qué base vectorial elegimos y por qué?"
  brain ask "Resume la política de modelos" --task classify
`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0];

  if (command !== "ask" || argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    process.exitCode = command === "ask" ? 0 : 1;
    return;
  }

  const rest = argv.slice(1);
  const positional: string[] = [];
  let outputMode: OutputMode = "text";
  let task: TaskType = "default";
  let allowOpus = false;
  let allowFable = false;
  let channel = "cli";

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    switch (arg) {
      case "--voice":
        outputMode = "voice";
        break;
      case "--allow-opus":
        allowOpus = true;
        break;
      case "--allow-fable":
        allowFable = true;
        break;
      case "--task":
        task = (rest[++i] as TaskType) ?? "default";
        break;
      case "--channel":
        channel = rest[++i] ?? "cli";
        break;
      default:
        positional.push(arg);
    }
  }

  const question = positional.join(" ").trim();
  if (!question) {
    console.error("Error: falta la pregunta. Uso: brain ask \"<pregunta>\"\n");
    printUsage();
    process.exitCode = 1;
    return;
  }

  console.log(`\n> ${question}\n`);

  try {
    const result = await askBrain({
      question,
      channel,
      outputMode,
      task,
      allowOpus,
      allowFable,
    });

    console.log(result.answer);
    console.log("\n---");
    console.log(`Modelo: ${result.model}`);
    if (result.citations.length > 0) {
      console.log(`Citas: ${result.citations.join(", ")}`);
    }
    if (result.toolsUsed.length > 0) {
      console.log(`Herramientas usadas: ${result.toolsUsed.join(", ")}`);
    }
    console.log(
      `Tokens: ${result.inputTokens} in / ${result.outputTokens} out ` +
        `(cache: ${result.cacheReadTokens} leídos, ${result.cacheWriteTokens} escritos) ` +
        `· Coste estimado: $${result.estimatedCostUsd.toFixed(6)} · ${result.durationMs} ms`,
    );

    if (result.isError && !result.refusal) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("Error inesperado en el gateway:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

main();
