# Fase 2 — Comparativa de herramientas por categoría

> Criterios evaluados por herramienta: madurez, API/SDK, ejecución local, licencia, escalabilidad, coste, integración con el stack Claude (MCP), y veredicto build/buy/integrate.
> Fuentes: búsquedas web julio 2026 (referencias al pie de cada sección) + conocimiento verificado a enero 2026.

---

## 2.1 Knowledge Management (wiki del equipo)

| Herramienta | Tipo | Self-host | Licencia | API | MCP | Veredicto |
|---|---|---|---|---|---|---|
| **Outline** | Wiki colaborativa UX tipo Notion | ✅ | BSL (gratis self-host) | REST completa | ✅ servidor MCP (leer/buscar/crear/editar docs) | **Elegida** — mejor UX self-host + MCP |
| **Notion** | SaaS todo-en-uno | ❌ | Propietaria, $10/usuario/mes (Plus) | REST | ✅ MCP oficial (OAuth) | **Alternativa válida** si el equipo ya lo usa |
| BookStack | Wiki estructurada (estantes/libros/páginas) | ✅ | MIT | REST | ✅ MCP comunitario | Buena, pero UX más rígida |
| Wiki.js | Wiki moderna con Git sync | ✅ | AGPL | GraphQL | Parcial | Editor bueno; comunidad menor |
| AppFlowy / Anytype | Notion open-source, local-first | ✅ | AGPL / SSPL-like | Limitada | Inmaduro | Prometedoras; API insuficiente para agentes hoy |
| Confluence | Enterprise | Cloud | Propietaria, $/usuario | REST | ✅ (Atlassian Remote MCP) | Overkill y caro para el tamaño actual |
| Obsidian / Logseq | Notas personales (Markdown local) | Local | Propietaria/AGPL | Vault = archivos | Vía filesystem | Excelente **complemento personal**; no es wiki de equipo |
| Mem.ai / Glean / Slite | SaaS búsqueda empresarial | ❌ | $$$/usuario | Sí | Parcial | Glean es la referencia enterprise pero sobredimensionado y caro |

**Análisis:** para que el Brain sea útil, la wiki debe ser *legible y escribible por agentes*. Outline y Notion son las dos con MCP maduro. Outline gana si se prioriza control/coste (self-host en el mismo VPS); Notion gana si se prioriza cero mantenimiento. **Ventaja extra de Outline:** los documentos son Markdown exportable → indexación RAG trivial y sin lock-in.
Complemento sin coste: **docs-as-code** — todo lo técnico vive en Markdown en los repos (el Brain lo lee con Glob/Grep/Read nativos del Agent SDK, sin integración alguna).

Fuentes: [Glen: BookStack vs Outline MCP](https://tryglen.com/compare/bookstack-vs-outline), [MCP.Directory: Knowledge Base MCP](https://mcp.directory/blog/best-knowledge-base-mcp-servers-2026), [Slite: open source KB 2026](https://slite.com/learn/open-source-knowledge-bases), [Contabo: self-hosted KB](https://contabo.com/blog/best-self-hosted-knowledge-base/)

---

## 2.2 AI Memory

Tres problemas distintos que el marketing mezcla:

1. **Memoria de trabajo del agente** (notas dentro de una tarea/sesión larga) → cubierto nativo por Anthropic (memory tool, Memory Stores, compaction). **No comprar nada.**
2. **Conocimiento documental** (RAG) → base vectorial (§2.5).
3. **Memoria organizacional evolutiva** (hechos sobre personas/proyectos/clientes que cambian con el tiempo) → aquí compiten los productos de esta sección.

| Herramienta | Enfoque | Self-host | Licencia | Fortaleza | Debilidad |
|---|---|---|---|---|---|
| **Graphiti** (Zep OSS) | Grafo de conocimiento **temporal** (cada relación tiene intervalo de validez) | ✅ (Neo4j o FalkorDB) | Apache 2.0 | Líder en razonamiento temporal; LongMemEval: Zep 63,8% vs Mem0 49,0% | Requiere backend de grafo; orientado a memoria, no a documentos |
| Zep (cloud) | Graphiti gestionado | ❌ | SaaS | Cero ops | Coste + lock-in |
| Mem0 | Capa de personalización drop-in | ✅ | Apache 2.0 | 5 líneas y funciona; mayor comunidad | Menor precisión temporal; pensado para personalización de usuarios finales |
| Letta (ex-MemGPT) | "OS de memoria" autogestionada por el agente | ✅ | Apache 2.0 | Agentes de horizonte muy largo | Es un framework completo → solapa con Agent SDK |
| LangMem | Memoria para LangGraph | ✅ | MIT | Integración LangGraph | Atado al ecosistema LangChain (que no usamos) |
| Neo4j + GraphRAG (Microsoft) | Grafo documental con detección de comunidades | ✅ | GPLv3/MIT | Mejores consultas globales analíticas | Indexación carísima ($50-200 por corpus que costaría $5 en vector; casos de 4 cifras) |
| LightRAG | GraphRAG simplificado | ✅ | MIT | 70-90% de calidad a ~1/100 del coste de indexación | Menos preciso en consultas globales |

**Veredicto:** Fase 1 del Brain sin producto de memoria externo (nativo Anthropic + pgvector). **Graphiti sobre FalkorDB o Neo4j en Fase 2**, cuando haya volumen real de hechos organizacionales. Mem0 descartada (caso de uso B2C). GraphRAG de Microsoft descartado por coste; si se necesita graph-RAG documental, LightRAG.

Fuentes: [Comparativa 5 sistemas de memoria](https://medium.com/@wasowski.jarek/i-compared-5-ai-agent-memory-systems-across-6-dimensions-none-wins-6a658335ed0a), [Particula: Mem0 vs Zep vs Letta](https://particula.tech/blog/agent-memory-frameworks-tested-mem0-zep-letta-cognee-2026), [MCP.Directory](https://mcp.directory/blog/mem0-vs-letta-vs-zep-vs-cognee-2026), [Paperclipped: Graph RAG en producción](https://www.paperclipped.de/en/blog/graph-rag-production/), [TypeGraph: open source Graph RAG](https://typegraph.ai/blog/best-open-source-graph-rag-tools)

---

## 2.3 AI Frameworks (orquestación de agentes)

| Framework | Naturaleza | Cuándo elegirlo | Contra para JorZunex |
|---|---|---|---|
| **Claude Agent SDK** | Harness Claude Code como librería (Py/TS) | Stack Claude-first; herramientas built-in; MCP, hooks, subagentes | Lock-in Anthropic (mitigable: la lógica de negocio vive en MCP/prompts) |
| LangGraph | Grafos de estado explícitos, multi-proveedor | Workflows deterministas complejos multi-modelo | Reinventa lo que el Agent SDK ya trae; curva y mantenimiento |
| OpenAI Agents SDK | Equivalente de OpenAI | Stack OpenAI-first | Peor con Claude |
| CrewAI | Multi-agente por roles | Prototipos rápidos multi-rol | Abstracción rígida, calidad de producción cuestionada |
| AutoGen (AG2) | Conversaciones multi-agente (MS Research) | Investigación | Cambios de rumbo frecuentes del proyecto |
| Semantic Kernel | .NET/enterprise Microsoft | Ecosistema .NET | No aplica |
| Mastra | Framework TS moderno (Vercel-friendly) | Apps TS con agentes ligeros | Menos maduro que Agent SDK para agentes profundos |
| LlamaIndex / Haystack | Frameworks RAG | Pipelines de ingestión complejos | Para nuestro RAG basta pgvector + código fino; evaluar LlamaIndex solo para ingestión |
| PydanticAI | Agentes tipados minimalistas (Py) | Microservicios LLM tipados | Complemento posible, no núcleo |

**Veredicto:** **Claude Agent SDK como núcleo** (decisión coherente con "no reinventar la rueda": es el único framework donde el bucle, las herramientas, los permisos y MCP vienen resueltos y probados en Claude Code). LangGraph queda documentado como plan B multi-proveedor.

Fuentes: [Agentlas: Claude Agent SDK review](https://agentlas.pro/frameworks/claude-agent-sdk/), [DigitalApplied: production patterns](https://www.digitalapplied.com/blog/claude-agent-sdk-production-patterns-guide)

---

## 2.4 Automatización

| Herramienta | Tier | Licencia | Coste | Veredicto |
|---|---|---|---|---|
| **n8n** | Low-code visual, ~400 integraciones | Sustainable Use (self-host gratis; restringe revender) | Cloud $20/mes; self-host gratis | **Elegida** para integraciones y triggers |
| Temporal | Ejecución durable enterprise | Apache 2.0 (OSS) / Cloud desde ~$100/mes | Alto (ops) | Overkill ahora; reevaluar si aparecen workflows críticos de días de duración |
| Windmill | Scripts+workflows para developers | AGPLv3 | Cloud $10/usuario/mes | Buen plan B developer-first |
| Trigger.dev | Tareas durables TS | Apache 2.0 | Cloud por uso | Plan B si el gateway es TS y queremos jobs durables en código |
| Kestra | Orquestación data-eng declarativa | Apache 2.0 | — | Orientada a data pipelines, no a este caso |
| Activepieces | n8n-like | MIT (community) | — | Menos integraciones/comunidad que n8n |
| Make / Zapier | SaaS no-code | Propietaria | $$ por operación, escala mal | Descartadas: coste por operación + sin self-host |

**Nota de licencia n8n:** la Sustainable Use License permite el uso interno de empresa sin coste; prohíbe ofrecer n8n como servicio a terceros. Para JorZunex (uso interno) es válida. Si algún día se revende automatización a clientes, revisar (→ Activepieces MIT o Windmill).

**Complemento nativo:** los **scheduled deployments de Managed Agents** cubren "agente en cron" sin n8n; y n8n cubre "evento externo → acción/agente". Son complementarios: n8n = sistema nervioso de eventos; agentes = cerebro.

Fuentes: [Automation Atlas: Temporal vs n8n](https://automationatlas.io/guides/temporal-vs-n8n-2026-comparison/), [Layer3Labs: open-source AI workflow tools](https://www.layer3labs.io/guides/open-source-ai-workflow-automation-tools), [InstaPods: self-hosted n8n alternatives](https://instapods.com/blog/n8n-alternatives/)

---

## 2.5 Bases de datos

| BD | Rol | Veredicto |
|---|---|---|
| **PostgreSQL** | Relacional + fuente de verdad | **Núcleo.** Todo estado del Brain (sesiones, logs de conversación, colas ligeras, config) |
| **pgvector** | Vectores dentro de Postgres | **Elegida para RAG inicial.** Con HNSW rinde comparable a motores dedicados hasta ~1M vectores; el consenso 2026 es "empieza en pgvector si ya estás en Postgres" (casos públicos: OpenWebUI migró DE Qdrant A pgvector; Confident AI de Pinecone a Postgres) |
| Supabase / Neon | Postgres gestionado | **Supabase** si se quiere auth+storage+realtime incluidos; **Neon** si solo Postgres serverless. Ambos con servidor MCP oficial |
| Qdrant | Vector dedicado | **Plan de escala** (>1-10M vectores, filtrado avanzado, latencia). Migración asumible si el código de retrieval está detrás de una interfaz propia |
| Weaviate | Vector + híbrido BM25 nativo | Alternativa a Qdrant si la búsqueda híbrida es central |
| Milvus / Pinecone / Chroma | Vector | Milvus: escala enorme (no necesaria); Pinecone: zero-ops pero caro y propietario; Chroma: prototipos |
| Redis | Caché/colas | Añadir solo cuando haya necesidad medida (Upstash si managed) |
| Neo4j / FalkorDB | Grafo | Solo como backend de Graphiti en Fase 2 (FalkorDB es más ligero de operar) |
| MongoDB | Documental | Sin caso de uso: Postgres JSONB lo cubre |
| ElasticSearch / OpenSearch | Búsqueda full-text | Sin caso de uso inicial: Postgres FTS + pgvector; reevaluar con >100K documentos |

Fuentes: [Kalvium: vector DBs en producción](https://www.kalviumlabs.ai/blog/vector-databases-compared-pgvector-pinecone-qdrant-weaviate/), [Benchmark 6 vector DBs](https://medium.com/@wasowski.jarek/i-benchmarked-6-vector-databases-for-rag-none-wins-everywhere-in-2026-900971966b7d), [CruxDigits: pgvector vs Qdrant](https://cruxdigits.nl/blog/vector-databases-for-rag-compared/)

---

## 2.6 Observabilidad

| Herramienta | Rol | Veredicto |
|---|---|---|
| **Langfuse** | Trazas/costes/evals LLM, OSS, self-host (Postgres+ClickHouse), OpenTelemetry | **Elegida.** Estándar de facto OSS; franja recomendada $30K–200K de gasto LLM/mes, pero self-hosted es gratis desde el día 1 |
| Phoenix (Arize OSS) | Evaluación offline rigurosa, drift, embeddings | Complemento futuro para evals sistemáticas |
| Helicone | Proxy drop-in, logging en minutos | Alternativa mínima si Langfuse pareciera excesivo al inicio |
| LangSmith | SaaS de LangChain | Descartada (no usamos LangChain; propietaria) |
| Arize (SaaS) | Enterprise ML observability | Sobredimensionada |
| Grafana + Prometheus + OTel | Observabilidad de infraestructura | Sí, para el VPS/servicios — Coolify trae básicos; ampliar cuando duela |

Fuentes: [Confident AI: top 7 LLM observability](https://www.confident-ai.com/knowledge-base/compare/top-7-llm-observability-tools), [Particula: Helicone vs Langfuse vs LangSmith](https://particula.tech/blog/helicone-vs-langfuse-vs-langsmith-llm-observability), [DigitalApplied: agent observability](https://www.digitalapplied.com/blog/agent-observability-platforms-langsmith-langfuse-arize-2026)

---

## 2.7 Modelos IA (política multi-modelo)

| Modelo | Precio (in/out por M) | Rol en el Brain |
|---|---|---|
| **Claude Fable 5** | $10 / $50 | Solo tareas de máxima dificultad: arquitectura, investigación profunda, runs agénticos largos críticos |
| **Claude Opus 5** | $5 / $25 | **Default** para trabajo agéntico y de conocimiento |
| **Claude Sonnet 5** | $3 / $15 (intro $2/$10) | Volumen con calidad: subagentes, RAG con respuesta elaborada |
| **Claude Haiku 4.5** | $1 / $5 | Clasificación, enrutado, extracción, resúmenes masivos (+Batches al 50%) |
| OpenAI / Gemini / Mistral / DeepSeek / Qwen / Llama | — | **No integrar ahora.** Multi-proveedor duplica testing y prompts. Mitigación de riesgo: interfaz de modelo abstraída en el gateway + MCP como capa neutral. Modelos locales (Llama/Qwen vía Ollama): sin caso de uso que justifique GPU propia; reevaluar solo por privacidad extrema |

Reglas de ahorro transversales: **prompt caching** (lecturas ~0,1×), **Batches** (−50%), **effort** bajo para tareas rutinarias, selección de modelo por tarea.

---

## 2.8 Desarrollo

| Herramienta | Veredicto |
|---|---|
| **GitHub** | Elegida: MCP oficial, Actions, ecosistema agéntico más maduro. GitLab sin ventaja aquí |
| **Claude Code** | Ya en uso; CLAUDE.md + skills del repo son parte del Brain |
| **Linear** | Gestión de trabajo: rápido, API/MCP excelente. Plane (OSS) como alternativa self-host; Jira descartado (fricción) |
| CodeRabbit / Claude Code review | Revisión de PRs con IA: empezar con `/code-review` de Claude Code (ya pagado); CodeRabbit opcional |
| Sourcegraph | Búsqueda de código multi-repo: innecesario a esta escala (Grep/Glob del SDK bastan) |
| Cursor / Windsurf / Continue | Editores IA: decisión personal de cada dev; no son piezas del Brain |
| Backstage | Portal developer enterprise: muy sobredimensionado |

---

## 2.9 Documentación técnica

| Herramienta | Veredicto |
|---|---|
| **Docusaurus** | Elegida si docs públicas/semi-públicas: OSS, Markdown en repo, deploy Vercel gratis |
| Mintlify | Alternativa SaaS más pulida (gratis hobby, $$ team); MCP propio |
| Nextra | Similar a Docusaurus, más minimalista — empate técnico |
| GitBook | SaaS; menos control |
| Swagger/OpenAPI + **Scalar** | Para APIs: Scalar como UI moderna de OpenAPI |

Principio: **docs-as-code siempre** — cualquier doc en Markdown dentro del repo es automáticamente parte del conocimiento del Brain.

---

## 2.10 Seguridad / Identidad

| Herramienta | Veredicto |
|---|---|
| **Clerk** | Elegida Fase 1 para las UIs del Brain: integración Next.js inmediata, gratis <10K MAU |
| Keycloak | El estándar self-host (SSO/OIDC/SAML) pero pesado de operar; adoptar solo si aparecen requisitos SSO enterprise |
| Auth.js / BetterAuth | Alternativas en-código válidas si se quiere evitar SaaS |
| Ory | Potente, complejidad alta — no ahora |
| Permit.io / Cerbos | Autorización fine-grained: prematuro; políticas en código + hooks del Agent SDK |
| **Vault (HashiCorp) / equivalente** | Los secretos importan desde el día 1: empezar con secrets de Coolify/entorno + vaults de Managed Agents para credenciales de agentes; Infisical (OSS) si crece |

---

## 2.11 Infraestructura

| Herramienta | Veredicto |
|---|---|
| **Docker Compose** | Base de todo el stack self-hosted |
| **Coolify** | PaaS self-hosted sobre VPS (Hetzner ~€20-40/mes): deploys git-push, SSL, backups. Elegida |
| Vercel | Frontales web/Next.js del Brain (el repo ya tiene tooling Vercel) |
| Railway / Fly.io | Alternativas managed si no se quiere VPS |
| Kubernetes | **No.** Prematuro; coste operativo injustificado |
| AWS / Azure / GCP | Solo servicios puntuales si hicieran falta; no como plataforma base |
| Cloudflare | DNS, proxy, protección — sí, capa gratuita |
| Terraform / Pulumi | Cuando haya más de un entorno que reproducir; no en Fase 1 |

---

## Resumen de veredictos

**Integrar (buy/adopt):** Claude API + Agent SDK + Managed Agents, MCP, Outline (o Notion), PostgreSQL+pgvector (Supabase/Neon), n8n, Langfuse, GitHub+Linear, Docusaurus, Clerk, Coolify+Vercel, Cloudflare, Graphiti (Fase 2), Qdrant (si escala).

**Construir (el 15%):** gateway del Brain (Agent SDK), puente WhatsApp, webhooks/canales, prompts+skills+políticas JorZunex, interfaz de retrieval propia (para poder cambiar pgvector→Qdrant sin dolor).

**Descartar:** LangChain/LangGraph (por ahora), CrewAI/AutoGen, GraphRAG Microsoft, Kubernetes, Jira/Confluence, Zapier/Make, Pinecone, MongoDB, Elastic, Sourcegraph, Backstage, Keycloak/Ory (por ahora), modelos multi-proveedor (por ahora).
