# JorZunex Brain — Resumen Ejecutivo y Recomendación Final

> Investigación: julio 2026 · Rol: Principal AI Research Engineer / Knowledge Architect / Solutions Architect / CTO
> Estado: **Fase de investigación completada — pendiente de aprobación antes de escribir código**

---

## 1. La corrección más importante del estudio

**Fable 5 no es una plataforma: es un modelo.** `claude-fable-5` es el modelo más capaz de Anthropic disponible de forma general ($10/M tokens entrada, $50/M salida, 1M de contexto, 128K de salida, razonamiento siempre activo). No tiene plugins, ni almacenamiento, ni conectores por sí mismo.

La **plataforma** real sobre la que se construye JorZunex Brain es el ecosistema que rodea al modelo:

| Pieza | Qué aporta |
|---|---|
| **Claude API** (Messages API) | Acceso al modelo: tool use, structured outputs, prompt caching, batches, files, vision, PDF |
| **Claude Agent SDK** (Python/TS) | El harness completo de Claude Code como librería: bucle agéntico, herramientas integradas (Read/Write/Bash/Grep/WebSearch), hooks, subagentes, sesiones, permisos, MCP |
| **Managed Agents** (beta) | Agentes hosted por Anthropic: sesiones con sandbox, deployments programados (cron), Memory Stores, vaults de credenciales, multi-agente |
| **MCP** (Model Context Protocol) | El bus universal de integración: +10.000 servidores públicos, gobernado por la Linux Foundation (Agentic AI Foundation), respaldado por Anthropic, OpenAI, Google y Microsoft |
| **Claude Code / claude.ai** | Superficie de uso directo para el equipo (desarrollo y trabajo de conocimiento) |

**Consecuencia arquitectónica:** el Brain no se "construye dentro de Fable 5". Se construye como un ecosistema donde Claude (Fable 5 / Opus 5 / Sonnet 5 / Haiku 4.5 según la tarea) es el motor de razonamiento, MCP es el sistema de integración, y herramientas especializadas cubren memoria, conocimiento, automatización y observabilidad.

---

## 2. Recomendación final (stack propuesto)

Objetivo cumplido: **~85% herramientas existentes, ~15% código propio** (pegamento, puentes de canal y políticas de negocio).

| Capa | Elección | Alternativas evaluadas | Por qué |
|---|---|---|---|
| Motor de razonamiento | **Claude API** — Opus 5 por defecto, Fable 5 para lo más difícil, Haiku 4.5 para volumen | OpenAI, Gemini, Mistral, locales | Mejor modelo agéntico; el stack (Agent SDK + MCP) es el más maduro para agentes |
| Orquestación de agentes | **Claude Agent SDK** (self-hosted) + **Managed Agents** para tareas programadas | LangGraph, CrewAI, OpenAI Agents SDK, Mastra | Cero código de bucle; mismo harness que Claude Code; MCP nativo |
| Bus de integración | **MCP** | APIs directas, Zapier/Make | Estándar de industria, multi-vendor, elimina integraciones a medida |
| Conocimiento (wiki equipo) | **Outline** (self-hosted, con servidor MCP) | Notion, BookStack, AppFlowy, Confluence | UX tipo Notion, self-host, API + MCP → el Brain lee/escribe la wiki |
| Base de datos | **PostgreSQL + pgvector** (Supabase o Neon) | Qdrant, Weaviate, Pinecone, MongoDB | Una sola base para datos + vectores hasta ~1-10M vectores; migrar a Qdrant solo si hace falta |
| Memoria de agentes | 3 capas: **archivos/Memory tool** + **pgvector (RAG)** + **Graphiti/Zep** (grafo temporal, fase 2) | Mem0, Letta, LangMem, Neo4j+GraphRAG | Cada capa cubre un tipo de memoria distinto; Graphiti líder en razonamiento temporal |
| Automatización | **n8n** (self-hosted) | Temporal, Windmill, Trigger.dev, Make, Zapier | Low-code + 400 integraciones; Temporal es overkill inicial |
| Observabilidad LLM | **Langfuse** (self-hosted, OpenTelemetry) | Phoenix, Helicone, LangSmith, Arize | Líder open source, self-host, agnóstico de framework |
| Desarrollo | **GitHub + Claude Code + GitHub Actions + Linear** | GitLab, Jira, Plane | Ecosistema con mejor soporte MCP/agentes |
| Documentación técnica | **Docusaurus** (o Mintlify si se prefiere SaaS) | GitBook, Nextra | Docs-as-code en el repo → el Brain las indexa gratis |
| Identidad/Auth | **Clerk** (fase 1) → evaluar Keycloak si crece | BetterAuth, Auth.js, Ory, Keycloak | Time-to-market; auth no es diferencial |
| Infraestructura | **Docker Compose → Coolify** (VPS) + **Vercel** para frontales | Kubernetes, Railway, Fly.io, AWS | Proporcional al tamaño del equipo; K8s prematuro |
| Canales | Slack (MCP/Chat SDK), correo (Gmail MCP), **WhatsApp vía Twilio API + puente propio** | Evolution API (riesgo de baneo) | WhatsApp no tiene MCP oficial: es de las pocas piezas 100% custom |

**Código propio (el 15%):** el *gateway* del Brain (un servicio sobre Agent SDK que enruta peticiones, aplica políticas y selecciona modelo), los puentes de canal (WhatsApp, webhooks entrantes), y los prompts/skills/políticas de JorZunex — que son justamente la ventaja competitiva.

---

## 3. Números clave

- **Coste mensual estimado fase inicial (equipo 2–5 personas):** ~150–500 €/mes (detalle en `06-riesgos-costes.md`), dominado por tokens de la API. Infra self-hosted: 20–60 €/mes en un VPS.
- **Fable 5 se usa quirúrgicamente**: es 2× el precio de Opus 5 y 3,3× el de Sonnet 5. La política de selección de modelo por tipo de tarea reduce el coste 60–80% frente a "todo con Fable 5".
- **Requisito duro de Fable 5:** exige retención de datos de 30 días (no compatible con zero-data-retention) y sus clasificadores de seguridad pueden rechazar peticiones (~<5% con fallback a Opus 4.8 configurable).

---

## 4. Documentos del estudio

| Doc | Contenido (fases del encargo) |
|---|---|
| `01-plataforma-anthropic-fable5.md` | Fase 1 — Estado del arte: qué es y qué no es Fable 5; capacidades, límites e integraciones de la plataforma Anthropic |
| `02-comparativa-herramientas.md` | Fase 2 — Comparativa por categoría (conocimiento, memoria, frameworks, automatización, BD, observabilidad, modelos, desarrollo, docs, seguridad, infra) |
| `03-matriz-decision.md` | Fase 3 — Matriz de decisión build/buy/integrate con criterios ponderados |
| `04-arquitectura.md` | Fase 4 — Arquitectura propuesta, diagrama, justificación por componente y estrategia anti-lock-in |
| `05-roadmap-pocs-backlog.md` | Fases 5–7 — Roadmap por fases, PoCs recomendadas, backlog priorizado |
| `06-riesgos-costes.md` | Fases 8–10 — Riesgos, estimación de costes y condiciones de la recomendación |

---

## 5. Decisión solicitada

Antes de escribir código, se necesita tu aprobación sobre 3 puntos:

1. **Wiki del equipo:** ¿Outline self-hosted (control y coste) o Notion SaaS (cero mantenimiento, el equipo quizá ya lo usa)? La arquitectura soporta ambos vía MCP.
2. **Grado de self-hosting:** el stack propuesto asume un VPS con Coolify. Si prefieres 100% SaaS/managed, cambian Supabase→Neon, n8n cloud, Langfuse cloud (coste +~100 €/mes, mantenimiento −90%).
3. **Presupuesto de tokens mensual objetivo**, para calibrar la política de modelos (cuánto Fable 5 vs Opus 5 vs Haiku).

Con eso aprobado, la primera PoC (P1 del roadmap: gateway con Agent SDK + MCP a la wiki + memoria en Postgres) es ejecutable en días, no semanas.
