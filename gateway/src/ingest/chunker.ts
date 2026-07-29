/** Un fragmento de un documento, listo para embeber y guardar en `document_chunks`. */
export interface Chunk {
  index: number;
  text: string;
}

export interface ChunkOptions {
  /** Tamaño objetivo de cada chunk, en palabras (proxy simple de "tokens" para esta PoC). */
  targetWords?: number;
  /** Solape entre chunks consecutivos dentro de una misma sección, en palabras. */
  overlapWords?: number;
}

const DEFAULT_TARGET_WORDS = 400; // ventana ~300-500 tokens pedida en la tarea
const DEFAULT_OVERLAP_WORDS = 60;

/**
 * Divide un Markdown en chunks "razonables": primero por encabezados
 * (cada `#`/`##`/`###`... arranca una sección nueva, que se queda con su
 * encabezado), y dentro de cada sección, si excede `targetWords`, en
 * ventanas solapadas de `targetWords` con `overlapWords` de solape.
 *
 * No es un tokenizador real de Claude (ver shared/token-counting.md — eso
 * es para contar tokens de llamadas al API) — aquí "palabras" es un proxy
 * suficiente para trocear texto de forma razonable en una ingesta local.
 */
export function chunkMarkdown(content: string, options: ChunkOptions = {}): Chunk[] {
  const targetWords = options.targetWords ?? DEFAULT_TARGET_WORDS;
  const overlapWords = options.overlapWords ?? DEFAULT_OVERLAP_WORDS;

  const sections = splitByHeaders(content);
  const chunks: Chunk[] = [];

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    const words = trimmed.split(/\s+/);
    if (words.length <= targetWords) {
      chunks.push({ index: chunks.length, text: trimmed });
      continue;
    }

    const step = Math.max(1, targetWords - overlapWords);
    for (let start = 0; start < words.length; start += step) {
      const windowWords = words.slice(start, start + targetWords);
      if (windowWords.length === 0) break;
      chunks.push({ index: chunks.length, text: windowWords.join(" ") });
      if (start + targetWords >= words.length) break;
    }
  }

  return chunks;
}

/** Parte el Markdown en secciones, cada una arrancando en una línea de encabezado (`#`...). */
function splitByHeaders(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const sections: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    const isHeader = /^#{1,6}\s+/.test(line);
    if (isHeader && current.length > 0) {
      sections.push(current.join("\n"));
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) sections.push(current.join("\n"));

  return sections;
}
