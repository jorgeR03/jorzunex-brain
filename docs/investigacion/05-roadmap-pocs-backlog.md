# Fases 5–7 — Roadmap, PoCs recomendadas y backlog priorizado

## Fase 5 — Roadmap

> Duraciones estimadas para 1 persona con Claude Code a tiempo parcial. Cada fase termina con algo en uso real por el equipo — nunca infraestructura sin usuarios.

### F0 · Fundamentos (semana 1)
- Repo `cerebro-jorzunex` con estructura, CLAUDE.md, `.mcp.json` compartido.
- VPS + Coolify; Postgres (o Supabase); Outline desplegado (o workspace Notion conectado).
- MCP conectados y probados desde Claude Code: GitHub, Outline/Notion, Postgres, Google Drive.
- **Entregable:** cualquier miembro del equipo abre Claude Code y el asistente ya "ve" wiki, repos y BD.

### F1 · Asistente con memoria (semanas 2–4)
- PoC-1 y PoC-2 (abajo): gateway mínimo + ingesta RAG.
- Pipeline de ingesta (n8n): Outline/Drive/repos → chunks → embeddings → pgvector.
- Langfuse desplegado y trazando.
- **Entregable:** "pregúntale al Brain" por Slack o CLI responde con conocimiento real de JorZunex y cita fuentes.

### F2 · Automatización y agentes programados (semanas 5–8)
- n8n en producción: 3–5 flujos reales (email→tarea, webhook GitHub→resumen, formulario→CRM).
- Managed Agents: primer deployment cron (informe semanal de actividad: GitHub + Linear + wiki → doc en Outline).
- Web UI interna v1 (Next.js + Clerk en Vercel).
- **Entregable:** el Brain trabaja solo al menos una vez por semana sin intervención.

### F3 · Multi-agente y canales (semanas 9–14)
- Subagentes especializados (investigador, redactor, revisor de PRs, analista).
- Puente WhatsApp (Twilio) → gateway.
- Memoria organizacional: PoC-4 Graphiti; si valida, integración como capa 3.
- **Entregable:** el equipo y (opcionalmente) clientes interactúan con el Brain por su canal preferido.

### F4 · Endurecimiento (continuo desde F2)
- Evals con Langfuse/Phoenix sobre los prompts críticos.
- Políticas de permisos por hook (acciones irreversibles → confirmación humana).
- Backups automatizados (Postgres, Outline export, volúmenes), runbook de restauración probado.
- Revisión de coste mensual con datos de Langfuse → ajustar ModelRouter.

## Fase 6 — PoCs recomendadas (orden de ejecución)

| # | PoC | Pregunta que responde | Éxito si… | Esfuerzo |
|---|---|---|---|---|
| **PoC-1** | Gateway mínimo: Agent SDK + MCP (Outline/Notion + GitHub) + log en Postgres | ¿El Agent SDK sostiene el patrón gateway multi-canal? | Una petición por CLI/Slack lee la wiki, responde con citas y queda trazada | 2–3 días |
| **PoC-2** | Ingesta RAG: n8n → embeddings → pgvector → retrieval en el gateway | ¿pgvector basta en calidad/latencia con nuestro corpus? | Recall aceptable en 20 preguntas de oro; p95 < 1s en retrieval | 2–3 días |
| **PoC-3** | Managed Agents scheduled deployment (informe semanal) | ¿La beta es fiable para cron? ¿Vaults resuelven credenciales? | 3 ejecuciones semanales seguidas sin intervención | 1–2 días |
| **PoC-4** | Graphiti + FalkorDB con datos reales (proyectos/clientes) | ¿El grafo temporal aporta sobre RAG plano? | Responde correctamente 10 preguntas temporales que pgvector falla | 3–4 días |
| **PoC-5** | Puente WhatsApp (Twilio sandbox → gateway) | ¿Latencia y formato aceptables en móvil? | Conversación fluida con memoria de sesión | 2 días |

Regla: **ninguna PoC pasa a producción sin revisar coste real en Langfuse.**

## Fase 7 — Backlog priorizado (MoSCoW)

### Must (F0–F1)
1. Repo + CLAUDE.md + convenciones (guía para agentes incluida)
2. VPS + Coolify + Postgres + backups básicos
3. Wiki (Outline o Notion) + MCP
4. MCP GitHub, Postgres, Drive configurados y versionados
5. Gateway v0 (PoC-1 endurecida): router, ModelRouter, hooks de auditoría, log en Postgres
6. Ingesta RAG v1 + interfaz `Retriever`
7. Langfuse + trazado completo del gateway
8. Manejo de refusals de Fable 5 + fallbacks server-side

### Should (F2)
8b. **Motor comercial v0** (epic de `docs/VISION.md` pilar 3): agente que investiga un lead y redacta borrador de propuesta con el conocimiento de la wiki — siempre con revisión humana antes de enviar
8c. **Voz en navegador** (ADR-0002 escalón A): micrófono + TTS gratis en la web UI
9. Bot de Slack
10. 3–5 flujos n8n de valor inmediato
11. Deployment cron informe semanal (Managed Agents)
12. Web UI interna v1 (chat + búsqueda + historial) con Clerk
13. Política de presupuesto: límites de gasto por canal/usuario en el ModelRouter
14. Suite de 30–50 preguntas de oro para evals de regresión

### Could (F3)
15. Subagentes especializados + biblioteca de skills JorZunex
16. Puente WhatsApp
17. Graphiti como capa de memoria organizacional
18. Revisión automática de PRs (subagente + GitHub Actions)
19. Digest diario personalizado por miembro del equipo
20. Docusaurus público para docs de producto

### Won't (por ahora — revisar cada trimestre)
- Kubernetes, Temporal, Keycloak, Elastic, Redis dedicado
- Multi-proveedor de modelos
- Qdrant (hasta superar ~1M vectores o dolor de filtrado)
- Fine-tuning / modelos locales
