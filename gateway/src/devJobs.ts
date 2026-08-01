import { randomUUID } from "node:crypto";

/**
 * Registro en memoria de tareas de desarrollo en curso — desbloquea que el
 * orquestador responda de inmediato ("voy a trabajar en segundo plano") en
 * vez de dejar la conversación bloqueada mientras `devAgent` corre (puede
 * tardar 30-90s+). Alcance deliberado de PoC: en memoria, no Postgres — este
 * sistema corre local, de un solo usuario; si la durabilidad entre
 * reinicios del gateway llega a importar de verdad, ver ADR-0003 paso 2
 * (tabla `jobs`) antes de construir esto de más.
 */

export type DevJobStatus = "running" | "done" | "error";

export interface DevJob {
  id: string;
  status: DevJobStatus;
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

export function createJob(project: string, instruction: string): DevJob {
  sweepOldJobs();
  const job: DevJob = {
    id: randomUUID(),
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
