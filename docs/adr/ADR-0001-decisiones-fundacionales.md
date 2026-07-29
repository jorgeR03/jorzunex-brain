# ADR-0001 — Decisiones fundacionales (wiki, hosting, presupuesto)

- **Fecha:** 2026-07-29
- **Estado:** Aceptada
- **Decisor:** Jorge (delegó el criterio a Claude con restricción explícita de presupuesto bajo: "no hay mucha plata pero algo se hace")

## Contexto

La investigación (`docs/investigacion/00-RESUMEN-EJECUTIVO.md §5`) dejó 3 decisiones bloqueantes. El usuario delegó la elección con una restricción dominante: **minimizar coste mensual**.

## Decisión 1 — Wiki: docs-as-code primero, Outline self-hosted después

- **Fase 0 (coste 0€):** todo el conocimiento en **Markdown dentro del repo** (`/docs`, `/prompts`, wiki en `/docs/wiki/`). El Brain lo lee gratis con las herramientas nativas del Agent SDK (Glob/Grep/Read). Sin servicio que pagar ni mantener.
- **Fase 1+ (cuando exista el VPS):** desplegar **Outline** en el mismo VPS vía Coolify para el equipo no técnico. Su export Markdown mantiene la compatibilidad con el corpus RAG.
- **Notion descartado:** $10/usuario/mes no se justifica con el presupuesto actual.

## Decisión 2 — Hosting: VPS único + Coolify (Escenario A del estudio)

- 1 VPS Hetzner (CX32, ~€20–25/mes; empezar incluso con CX22 ~€8/mes) con Coolify.
- Servicios en él: gateway, Postgres+pgvector, n8n, Langfuse, Outline (cuando toque).
- Vercel free/hobby para la web UI. Cloudflare free para DNS.
- Kubernetes, Railway, cloud grandes: descartados (coste/complejidad).
- **Hasta que Jorge contrate el VPS, todo se desarrolla y prueba en local con Docker Compose** — coste 0€.

## Decisión 3 — Presupuesto de tokens: tope inicial ~50–60 €/mes en API

Política del ModelRouter (vinculante para todo código):

| Tarea | Modelo | Nota |
|---|---|---|
| Default del gateway | `claude-sonnet-5` | Precio intro $2/$10 hasta 31-08-2026 |
| Clasificar / enrutar / extraer / bulk | `claude-haiku-4-5` | + Batches (−50%) si no es interactivo |
| Trabajo agéntico complejo | `claude-opus-5` | Solo por flag explícito o política |
| Crítico | `claude-fable-5` | **DESACTIVADO por defecto.** Solo si Jorge lo pide expresamente para una tarea |

- Prompt caching obligatorio en todo prompt de sistema estable.
- Alertas: revisar gasto en Langfuse semanalmente; si el mes proyecta >60€, degradar defaults un escalón.
- **El desarrollo interactivo se hace en Claude Code con la cuota de la suscripción (Sonnet/Opus del plan), NO con la API ni con Fable 5 a crédito.** El gasto de API queda reservado al runtime del gateway.

## Consecuencias

- F0 puede empezar HOY con coste 0€ (repo + docs + gateway en local).
- El primer gasto real (~€10–25/mes VPS) se pospone hasta que la PoC-1 funcione en local y Jorge decida desplegar.
- Se pierde algo de calidad máxima por defecto (Sonnet vs Opus/Fable); recuperable subiendo el nivel por tarea cuando el valor lo justifique.
