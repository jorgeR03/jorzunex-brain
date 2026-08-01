/**
 * Cliente HTTP determinista hacia "Agende de Ventas" (carpeta hermana, NO
 * parte de este repo) — el mini-CRM de prospección ya funcional de JorZunex
 * (OpenStreetMap + pipeline de estados + plantillas de WhatsApp/email por
 * vertical). Ver docs/VISION.md pilar 3: "integrar, no duplicar".
 *
 * Deliberadamente NO es una tool del Agent SDK (ver commercialAgent.ts): son
 * llamadas HTTP planas que el orquestador hace por su cuenta, nunca algo que
 * el modelo pueda invocar directamente — así el guardarraíl de "nunca tocar
 * datos de contacto" no depende de que el modelo respete una instrucción,
 * es una restricción de código que no puede saltarse.
 *
 * Best-effort: si Agende de Ventas no está corriendo (server.js debe
 * levantarse a mano, no tiene proceso administrado), todo aquí devuelve
 * null/false en vez de lanzar — mismo patrón que createRetriever.
 */

const AGENDE_VENTAS_URL = process.env.AGENDE_VENTAS_URL ?? "http://localhost:4321";
const TIMEOUT_MS = 3000;

export interface Lead {
  id: string;
  osmId?: string;
  name: string;
  vertical: string;
  city: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  contactName?: string;
  source?: string;
  status: string;
  notes?: string;
  nextFollowUp?: string;
  createdAt: string;
  updatedAt: string;
}

/** Único subconjunto de campos que este cliente permite escribir — nunca datos de identidad/contacto. */
export interface LeadResearchPatch {
  notes?: string;
  status?: string;
  nextFollowUp?: string;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function fetchJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${AGENDE_VENTAS_URL}${path}`, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Agende de Ventas respondió ${response.status} en ${path}`);
  }
  return response.json();
}

/** true si el servidor local de Agende de Ventas está arriba y respondiendo. */
export async function isReachable(): Promise<boolean> {
  try {
    await fetchJson("/api/verticals");
    return true;
  } catch {
    return false;
  }
}

/**
 * Busca un lead ya existente en el pipeline por nombre (+ ciudad opcional).
 * No hay endpoint de búsqueda en Agende de Ventas (POST /api/search dispara
 * una búsqueda NUEVA en OpenStreetMap, no una consulta del pipeline actual)
 * — se trae todo /api/leads y se filtra en el cliente; el pipeline es
 * pequeño (decenas de leads), de sobra para esto.
 */
export async function findLead(query: { name: string; city?: string }): Promise<Lead | null> {
  try {
    const leads = (await fetchJson("/api/leads")) as Lead[];
    const nameNorm = normalize(query.name);
    const cityNorm = query.city ? normalize(query.city) : undefined;

    const candidates = leads.filter((lead) => {
      const leadName = normalize(lead.name);
      const nameMatches = leadName.includes(nameNorm) || nameNorm.includes(leadName);
      if (!nameMatches) return false;
      if (!cityNorm) return true;
      return normalize(lead.city).includes(cityNorm);
    });

    return candidates[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Anota el resultado de la investigación en el CRM: SOLO notes/status/
 * nextFollowUp. El endpoint upstream (Agende de Ventas) acepta más campos
 * (phone/email/name/contactName) pero este tipo (LeadResearchPatch) hace
 * estructuralmente imposible enviar esos — la protección real es esta
 * frontera de tipos, no la buena fe del servidor upstream.
 */
export async function patchLeadResearch(id: string, patch: LeadResearchPatch): Promise<Lead | null> {
  try {
    return (await fetchJson(`/api/leads/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })) as Lead;
  } catch {
    return null;
  }
}

/** Lee lib/templates.js de Agende de Ventas como texto plano para dárselo de contexto al agente comercial — nunca se ejecuta, solo se lee como referencia de tono/producto/precio. */
export async function readPitchTemplatesSource(): Promise<string | undefined> {
  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  try {
    const templatesPath = path.resolve(
      process.env.AGENDE_VENTAS_ROOT ?? "C:/Users/jorge/ProyectosJorZunex/Agende de ventas",
      "lib",
      "templates.js",
    );
    return await readFile(templatesPath, "utf8");
  } catch {
    return undefined;
  }
}
