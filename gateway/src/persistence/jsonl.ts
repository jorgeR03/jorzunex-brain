import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { ConversationRecord, ConversationStore } from "./types.js";

/**
 * Adaptador de fallback: una línea JSON por interacción en un archivo local.
 * Se usa automáticamente cuando Postgres no está disponible (Docker apagado,
 * sin credenciales, etc.) para que `brain ask` nunca se bloquee por la
 * persistencia. El archivo vive en `data/conversations.jsonl` (gitignored).
 */
export class JsonlConversationStore implements ConversationStore {
  readonly backend = "jsonl" as const;
  private readonly filePath: string;
  private initialized = false;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  private async ensureDir(): Promise<void> {
    if (this.initialized) return;
    await mkdir(path.dirname(this.filePath), { recursive: true });
    this.initialized = true;
  }

  async save(record: ConversationRecord): Promise<void> {
    await this.ensureDir();
    const line = JSON.stringify(record) + "\n";
    await appendFile(this.filePath, line, "utf8");
  }

  async close(): Promise<void> {
    // No hay conexiones que cerrar: cada escritura abre/cierra el archivo.
  }
}
