# Fase 1 — Estado del arte: Fable 5 y la plataforma Anthropic

> Fuentes primarias: documentación oficial del API de Claude (referencia interna verificada, julio 2026), anuncio oficial https://www.anthropic.com/news/claude-fable-5-mythos-5

## 1. Qué es exactamente Fable 5

- **Modelo:** `claude-fable-5`. Primer modelo de la familia Claude 5, del nuevo tier "Mythos-class" (por encima de Opus). `claude-mythos-5` es el mismo modelo sin ciertas salvaguardas, restringido a organizaciones aprobadas (Project Glasswing).
- **Precio:** $10 / M tokens de entrada, $50 / M tokens de salida. Es el modelo más caro del catálogo (Opus 5: $5/$25 · Sonnet 5: $3/$15, intro $2/$10 hasta 31-08-2026 · Haiku 4.5: $1/$5).
- **Contexto:** 1M tokens (por defecto y máximo). Salida máxima: 128K tokens.
- **Posicionamiento:** estado del arte en casi todos los benchmarks; especialmente fuerte en ingeniería de software, trabajo de conocimiento, visión y trabajo agéntico de largo horizonte (turnos individuales de muchos minutos son normales).

### 1.1 Qué permite hacer (capacidades API relevantes para el Brain)

| Capacidad | Detalle |
|---|---|
| Tool use / function calling | Completo, con ejecución paralela, structured outputs, strict schemas |
| Herramientas de servidor | Web search, web fetch, ejecución de código (sandbox Anthropic), tool search |
| MCP nativo | `mcp_servers` en el API; MCP en Agent SDK; MCP en Managed Agents |
| Prompt caching | Prefijo cacheable desde 512 tokens; lecturas a ~0,1× el precio |
| Compaction / context editing | Conversaciones que exceden el contexto se resumen server-side |
| Memory tool | Herramienta cliente (`memory_20250818`): el modelo lee/escribe un directorio `/memories` que tú almacenas |
| Batches | Procesamiento asíncrono al 50% del precio |
| Visión de alta resolución | 2576px lado largo; coordenadas 1:1 con píxeles |
| Task budgets | Presupuesto de tokens que el modelo ve y gestiona en bucles agénticos |

### 1.2 Qué NO permite / limitaciones duras

1. **No es una plataforma de aplicaciones.** No hay "plugins de Fable 5", ni almacenamiento propio, ni UI extensible. Todo eso vive en las capas de plataforma (abajo).
2. **Razonamiento siempre activo y opaco:** no se puede desactivar el thinking (400 si se intenta); la cadena de razonamiento cruda nunca se devuelve (solo resúmenes con `display: "summarized"`).
3. **Clasificadores de seguridad:** peticiones sobre ciberseguridad ofensiva o biología dual-use pueden devolver `stop_reason: "refusal"` (HTTP 200, no error). Afecta a <5% de sesiones; hay *fallback* server-side configurable a Opus 4.8. Cualquier código de producción debe manejar este caso.
4. **Retención de datos de 30 días obligatoria.** Fable 5 no está disponible bajo zero-data-retention. Si JorZunex necesitara ZDR por compliance, habría que usar Opus 5.
5. **Sin prefill de asistente**, sin parámetros de sampling (`temperature`/`top_p`/`top_k`).
6. **Coste y latencia:** no es el modelo para chat trivial ni clasificación masiva. La plataforma existe justamente para enrutar cada tarea al modelo adecuado.

## 2. La plataforma real: 4 superficies para construir

### 2.1 Claude API (Messages API)
La base. Una sola llamada = una respuesta. Adecuada para: clasificación, extracción, resumen, pipelines controlados por código. No gestiona estado ni bucles por ti.

### 2.2 Claude Agent SDK (`claude-agent-sdk` / `@anthropic-ai/claude-agent-sdk`)
**La pieza central recomendada para el Brain.** Es Claude Code empaquetado como librería (Python y TypeScript):

- Bucle agéntico completo + gestión de contexto.
- Herramientas integradas: Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch.
- **Hooks** (PreToolUse, PostToolUse, SessionStart…) → puntos de control para políticas de seguridad y auditoría.
- **Subagentes** → paralelización y especialización.
- **Servidores MCP** → cualquier integración externa sin código propio.
- Sistema de permisos, sesiones y skills.

Tú lo alojas (tu servidor, tu VPC). Patrón de producción documentado: sesión SDK efímera + log de conversación como fuente de verdad en Postgres.

### 2.3 Managed Agents (beta)
Anthropic aloja el bucle *y* el sandbox de ejecución. Aporta piezas que costaría meses construir:

- **Deployments programados (cron):** "cada viernes a las 20:00 genera el informe semanal" sin scheduler propio.
- **Memory Stores:** memoria persistente entre sesiones, montada como filesystem, con versionado y redacción — gestionada por Anthropic.
- **Vaults:** credenciales (OAuth MCP con auto-refresh, variables de entorno sustituidas en egreso) que nunca entran al sandbox.
- **Outcomes:** bucles iterar→evaluar→revisar contra una rúbrica.
- **Multi-agente** con hilos por subagente.

Riesgo: es beta y aumenta el lock-in. Uso recomendado: tareas programadas y trabajos batch, no el camino crítico interactivo.

### 2.4 Claude Code / claude.ai
La superficie de consumo directo del equipo: desarrollo (Claude Code con CLAUDE.md, skills y MCP del proyecto) y trabajo de conocimiento (claude.ai con conectores Google Drive, Gmail, Calendar…). El Brain no reemplaza esto: lo complementa compartiendo los mismos servidores MCP y la misma memoria.

## 3. Cómo se conecta con cada sistema que pediste investigar

| Sistema | Vía | Estado |
|---|---|---|
| GitHub | Servidor MCP oficial de GitHub (`api.githubcopilot.com/mcp/`) + `gh` CLI en Agent SDK | Maduro |
| Slack | MCP de Slack; alternativamente Chat SDK (Vercel) para bots multi-plataforma | Maduro |
| Google Drive / Gmail / Calendar | Conectores oficiales claude.ai + servidores MCP | Maduro |
| Notion | MCP oficial de Notion (`mcp.notion.com`) — ojo: usa OAuth, no el token `ntn_` del API REST | Maduro |
| PostgreSQL | Servidores MCP de Postgres (oficial y de Supabase/Neon); o acceso directo desde herramientas del SDK | Maduro |
| Neo4j | Servidor MCP de Neo4j (cypher); Graphiti lo usa como backend | Disponible |
| Qdrant | Servidor MCP de Qdrant; SDK propio | Disponible |
| Correo (genérico) | MCP Gmail/IMAP; envío vía Resend/SMTP desde herramientas | Disponible |
| Documentos (PDF, Office) | Nativo en el API (PDF), skills xlsx/docx/pptx/pdf en Managed Agents/code execution | Maduro |
| **WhatsApp** | **No hay MCP oficial.** Opciones: WhatsApp Business API vía Twilio/Meta Cloud API + puente propio; Evolution API (no oficial, riesgo de baneo) | **Gap — pieza custom** |
| Bases de conocimiento (Outline/BookStack) | Servidores MCP comunitarios que exponen sus APIs REST completas | Disponible |

## 4. Estado del ecosistema MCP (por qué es la apuesta de integración correcta)

- **Gobernanza multi-vendor:** donado en diciembre 2025 a la Agentic AI Foundation (Linux Foundation); gobernado por Anthropic, OpenAI y Block. Google y Microsoft lo soportan.
- **Escala:** registro oficial con ~9.700 servidores (mayo 2026), +19.800 indexados en Glama, ~97M descargas mensuales de SDKs.
- **Adopción empresarial:** 41% de organizaciones encuestadas con MCP en producción limitada o amplia (Stacklok 2026); casos como Pinterest (~66.000 invocaciones/mes, ~7.000 h de ingeniería ahorradas/mes).
- **Implicación:** cada integración del Brain construida como cliente MCP funciona hoy con Claude y mañana con cualquier otro modelo/agente compatible. **MCP es la principal defensa anti-lock-in del diseño.**

## 5. Cómo almacenar memoria (opciones nativas vs externas)

| Mecanismo | Naturaleza | Cuándo |
|---|---|---|
| Memory tool (`memory_20250818`) | Archivos que el modelo gestiona; backend tuyo | Memoria de trabajo de cada agente; barato y transparente |
| Memory Stores (Managed Agents) | Documentos versionados gestionados por Anthropic | Agentes hosted programados |
| RAG con pgvector/Qdrant | Búsqueda semántica sobre corpus | Conocimiento documental de la empresa |
| Graphiti/Zep (grafo temporal) | Entidades + relaciones con validez temporal | "Quién era responsable de X en febrero"; memoria organizacional evolutiva |

Conclusión de fase 1: **la plataforma Anthropic cubre nativamente el motor, la orquestación, la integración (MCP) y la memoria básica.** Las categorías donde sí hay que elegir herramienta externa son: wiki/conocimiento humano, base de datos, memoria avanzada (grafo), automatización low-code, observabilidad, auth e infraestructura → Fase 2.
