/**
 * ModelRouter — única fuente de verdad para qué modelo Claude se usa en cada
 * tarea del gateway. Ningún otro módulo debe escribir literalmente un
 * `"claude-..."` — todo pasa por `resolveModel()`.
 *
 * Política vinculante: docs/adr/ADR-0001-decisiones-fundacionales.md §3.
 *
 *   | Tarea                        | Modelo              | Nota                                   |
 *   |-------------------------------|---------------------|-----------------------------------------|
 *   | default (gateway)             | claude-sonnet-5     | precio intro $2/$10 hasta 2026-08-31    |
 *   | classify / route / extract    | claude-haiku-4-5    | + Batches si no es interactivo          |
 *   | bulk                          | claude-haiku-4-5    |                                          |
 *   | agentic (trabajo complejo)    | claude-opus-5       | solo con flag explícito `allowOpus`     |
 *   | critical                      | claude-fable-5      | DESACTIVADO — requiere `allowFable`     |
 */

export type TaskType =
  | "default"
  | "classify"
  | "route"
  | "extract"
  | "bulk"
  | "agentic"
  | "critical";

export interface ModelRouterOptions {
  /** Tipo de tarea a resolver. Por defecto: "default" (Sonnet 5). */
  task?: TaskType;
  /**
   * Flag explícito requerido para autorizar "claude-opus-5" en tareas
   * "agentic". Sin este flag, ModelRouter lanza un error en vez de usar
   * Opus silenciosamente (ADR-0001 §3: "solo por flag explícito o política").
   */
  allowOpus?: boolean;
  /**
   * Override explícito requerido para autorizar "claude-fable-5". Fable 5
   * está DESACTIVADO por defecto (ADR-0001 §3) — solo se activa si Jorge lo
   * pide expresamente para una tarea concreta.
   */
  allowFable?: boolean;
}

/** Precios oficiales por millón de tokens (input/output), USD. Fuente: catálogo de modelos vigente. */
export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

const MODEL_TABLE: Readonly<Record<TaskType, string>> = Object.freeze({
  default: "claude-sonnet-5",
  classify: "claude-haiku-4-5",
  route: "claude-haiku-4-5",
  extract: "claude-haiku-4-5",
  bulk: "claude-haiku-4-5",
  agentic: "claude-opus-5",
  critical: "claude-fable-5",
});

/**
 * Precios por millón de tokens. Sonnet 5 usa el precio introductorio
 * vigente hasta 2026-08-31 ($2/$10); tras esa fecha pasa a $3/$15 — revisar
 * este archivo cuando corresponda (ver ADR-0001 §3, nota de precio).
 */
export const PRICING_TABLE: Readonly<Record<string, ModelPricing>> = Object.freeze({
  "claude-sonnet-5": { inputPerMillion: 2.0, outputPerMillion: 10.0 },
  "claude-haiku-4-5": { inputPerMillion: 1.0, outputPerMillion: 5.0 },
  "claude-opus-5": { inputPerMillion: 5.0, outputPerMillion: 25.0 },
  "claude-fable-5": { inputPerMillion: 10.0, outputPerMillion: 50.0 },
});

export class ModelRouterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelRouterError";
  }
}

/**
 * Resuelve el modelo Claude a usar para una tarea dada, aplicando la
 * política del ADR-0001 §3. Lanza ModelRouterError si se pide Opus o Fable
 * sin el flag explícito correspondiente.
 */
export function resolveModel(options: ModelRouterOptions = {}): string {
  const task = options.task ?? "default";
  const model = MODEL_TABLE[task];

  if (!model) {
    throw new ModelRouterError(
      `ModelRouter: tarea desconocida "${task}". Tareas válidas: ${Object.keys(MODEL_TABLE).join(", ")}.`,
    );
  }

  if (model === "claude-opus-5" && !options.allowOpus) {
    throw new ModelRouterError(
      `ModelRouter: "claude-opus-5" requiere el flag explícito allowOpus=true (tarea="${task}"). ` +
        `Ver ADR-0001 §3: Opus solo se usa por flag explícito o política, nunca por defecto.`,
    );
  }

  if (model === "claude-fable-5" && !options.allowFable) {
    throw new ModelRouterError(
      `ModelRouter: "claude-fable-5" está DESACTIVADO por defecto (ADR-0001 §3). ` +
        `Requiere override explícito allowFable=true, solicitado expresamente por Jorge para esta tarea.`,
    );
  }

  return model;
}

/** Estima el coste en USD de una interacción a partir de los tokens usados. */
export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = PRICING_TABLE[model];
  if (!pricing) {
    return 0;
  }
  const cost =
    (inputTokens / 1_000_000) * pricing.inputPerMillion +
    (outputTokens / 1_000_000) * pricing.outputPerMillion;
  return Number(cost.toFixed(6));
}
