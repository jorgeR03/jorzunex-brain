import type { BrainConfig } from "../config.js";
import { PostgresConversationStore } from "./postgres.js";
import { JsonlConversationStore } from "./jsonl.js";
import type { ConversationStore } from "./types.js";

export type { ConversationRecord, ConversationStore } from "./types.js";

/**
 * Factory de la capa de persistencia. Dos adaptadores intercambiables:
 *
 * - `postgres`: preferido (docs/adr/ADR-0001). Requiere que el contenedor de
 *   `infra/docker-compose.yml` esté arriba y con el esquema aplicado.
 * - `jsonl`: fallback local en `data/conversations.jsonl` cuando Postgres no
 *   está disponible (Docker apagado, sin credenciales...). Nunca bloquea al
 *   usuario de `brain ask`.
 *
 * Modo `auto` (por defecto): intenta Postgres con un ping corto; si falla,
 * cae a JSONL y avisa por stderr una sola vez.
 */
export async function createConversationStore(config: BrainConfig): Promise<ConversationStore> {
  const mode = config.storageBackend;

  if (mode === "jsonl") {
    return new JsonlConversationStore(config.jsonlPath);
  }

  if (mode === "postgres") {
    const store = new PostgresConversationStore({ connectionString: config.postgres.connectionString });
    await store.ping(); // deja que falle explícitamente si el usuario forzó "postgres"
    return store;
  }

  // mode === "auto": probar Postgres, caer a JSONL si no responde.
  const pgStore = new PostgresConversationStore({ connectionString: config.postgres.connectionString });
  try {
    await pgStore.ping();
    return pgStore;
  } catch (error) {
    await pgStore.close().catch(() => undefined);
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `[brain] Postgres no disponible (${reason}). Usando fallback JSONL en ${config.jsonlPath}\n`,
    );
    return new JsonlConversationStore(config.jsonlPath);
  }
}
