import { randomUUID } from "node:crypto";

/**
 * Registro en memoria de tareas en curso (de desarrollo o comerciales) —
 * desbloquea que el orquestador responda de inmediato ("voy a trabajar en
 * segundo plano") en vez de dejar la conversación bloqueada mientras
 * `devAgent`/`commercialAgent` corren (puede tardar 30-90s+). Alcance
 * deliberado de PoC: en memoria, no Postgres — este sistema corre local, de
 * un solo usuario; si la durabilidad entre reinicios del gateway llega a
 * importar de verdad, ver ADR-0003 paso 2 (tabla `jobs`) antes de construir
 * esto de más.
 *
 * `kind` distingue tareas de desarrollo ("dev_task", campo `project`) de
 * tareas comerciales ("commercial", mismo campo `project` reutilizado como
 * el lead investigado) — un solo Map/store para ambas: es la misma forma y
 * el mismo ciclo de vida, no hay motivo real para duplicar el módulo.
 */

export type DevJobStatus = "running" | "done" | "error";
export type DevJobKind = "dev_task" | "commercial";

export interface DevJob {
  id: string;
  kind: DevJobKind;
  status: DevJobStatus;
  /** Nombre de proyecto real (dev_task) o texto libre del lead investigado (commercial). */
  project: string;
  instruction: string;
  createdAt: number;
  finishedAt?: number;
  answer?: string;
  model?: string;
  filesChanged?: string[];
  blockedCommands?: string[];
  errorMessage?: string;
}

const JOBS = new Map<string, DevJob>();
const MAX_JOB_AGE_MS = 60 * 60 * 1000; // 1h — evita crecimiento sin límite del Map

function sweepOldJobs(): void {
  const now = Date.now();
  for (const [id, job] of JOBS) {
    if (job.finishedAt && now - job.finishedAt > MAX_JOB_AGE_MS) {
      JOBS.delete(id);
    }
  }
}

export function createJob(kind: DevJobKind, project: string, instruction: string): DevJob {
  sweepOldJobs();
  const job: DevJob = {
    id: randomUUID(),
    kind,
    status: "running",
    project,
    instruction,
    createdAt: Date.now(),
  };
  JOBS.set(job.id, job);
  return job;
}

export function updateJob(id: string, patch: Partial<Omit<DevJob, "id">>): void {
  const job = JOBS.get(id);
  if (!job) return;
  Object.assign(job, patch);
}

export function getJob(id: string): DevJob | undefined {
  return JOBS.get(id);
}
