# Fases 8–10 — Riesgos, estimación de costes y condiciones de la recomendación

## Fase 8 — Registro de riesgos

| # | Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|---|
| R1 | **Coste de tokens descontrolado** (Fable 5 = $10/$50 por M) | Alta | Alto | ModelRouter con presupuestos por canal/usuario; Fable 5 solo bajo criterio explícito; prompt caching (~0,1× en lecturas); Batches (−50%); alertas de gasto en Langfuse desde el día 1 |
| R2 | **Lock-in Anthropic** | Media | Alto | Datos en Postgres/Markdown propios; integraciones en MCP (multi-vendor, Linux Foundation); prompts versionados; LangGraph documentado como plan B; el coste de migrar queda acotado al gateway |
| R3 | **Managed Agents es beta** (cambios de API, límites) | Media | Medio | Uso restringido a cron/batch no crítico; cada deployment reproducible como n8n cron + gateway |
| R4 | **Prompt injection vía MCP/contenido externo** (un doc/email malicioso instruye al agente) | Media | Alto | Hooks PreToolUse con lista blanca por canal; confirmación humana para acciones irreversibles (enviar, borrar, pagar); servidores MCP de escritura limitados al mínimo; sin credenciales en prompts (vaults) |
| R5 | **Refusals de clasificadores de Fable 5** (<5% sesiones; seguridad/bio) | Baja | Medio | `fallbacks: "default"` server-side (ruta a Opus 4.8); manejo de `stop_reason: refusal` en el gateway |
| R6 | **Retención 30 días obligatoria en Fable 5** vs futuras exigencias de clientes (ZDR) | Baja | Medio | Si un cliente exige ZDR, esas cargas van a Opus 5 (sí compatible); documentarlo en contratos |
| R7 | **Calidad variable de servidores MCP comunitarios** | Media | Medio | Preferir oficiales; fijar versiones; revisar código de los comunitarios con permisos de escritura |
| R8 | **Licencia n8n (Sustainable Use)** si algún día se revende automatización | Baja | Medio | Uso interno OK; si se comercializa, migrar a Activepieces (MIT)/Windmill — los flujos son exportables |
| R9 | **Bus factor / ops del self-hosting** (una persona mantiene el VPS) | Media | Medio | Coolify simplifica; backups automáticos probados; runbook en la wiki; opción de escape 100% managed documentada (Supabase, n8n cloud, Langfuse cloud) |
| R10 | **Deriva de calidad al cambiar versiones de modelo** | Media | Medio | Suite de preguntas de oro + evals en Langfuse antes de cambiar el default del ModelRouter |
| R11 | **Sobre-ingeniería** (el riesgo clásico de los "AI brains") | Alta | Medio | Regla de aplazamiento (Fase 3); cada fase del roadmap termina en uso real; el backlog "Won't" es vinculante hasta revisión trimestral |

## Fase 9 — Estimación de costes

### Escenario A — Self-hosted (recomendado), equipo 2–5 personas

| Concepto | €/mes |
|---|---|
| VPS Hetzner CX32/CX42 (Coolify: gateway, Outline, n8n, Langfuse, Postgres) | 20–45 |
| Backups + almacenamiento objetos | 5–10 |
| Dominio + Cloudflare | 1–2 |
| Vercel (hobby/Pro según UI) | 0–20 |
| Clerk (<10K MAU) | 0 |
| Twilio WhatsApp (F3, volumen bajo) | 5–20 |
| Suscripciones Claude del equipo (Pro/Max, ya existentes) | según plan actual |
| **API Claude (gateway + agentes)** — la partida dominante | **100–400** (ver desglose) |
| **Total** | **~150–500 €/mes** |

**Desglose API (estimación de trabajo, a validar en PoC-1/2 con Langfuse):**
- Supuesto: ~1.500 interacciones/mes por el gateway + 30 runs agénticos largos + ingesta/clasificación masiva.
- Mix 70% Haiku/Sonnet (interacciones cortas, RAG) ≈ 30–80 €.
- 25% Opus 5 (trabajo agéntico estándar) ≈ 60–200 €.
- 5% Fable 5 (tareas críticas) ≈ 20–100 €.
- Prompt caching bien aplicado reduce 40–70% el coste de entrada en conversaciones largas.

### Escenario B — 100% managed (si no se quiere operar VPS)

| Cambio | €/mes extra aprox. |
|---|---|
| Supabase Pro (25) + n8n cloud (20) + Langfuse cloud (0–59) + Outline cloud→Notion ($10/usuario) | +80–150 |
| **Total** | **~250–650 €/mes**, mantenimiento ≈ 0 |

### Coste de construcción (esfuerzo)
- F0–F1: ~3–4 semanas·persona · F2: ~3 · F3: ~4–6. Con Claude Code el multiplicador real observado en proyectos similares es 2–3× menos calendario que estas cifras clásicas.

## Fase 10 — Recomendación final y condiciones

**Recomendación:** ejecutar el stack del resumen ejecutivo (`00-RESUMEN-EJECUTIVO.md §2`), empezando por PoC-1 y PoC-2, con las siguientes condiciones vinculantes:

1. **Fable 5 es bisturí, no martillo.** Default = Opus 5; Fable 5 solo por decisión del ModelRouter para tareas etiquetadas como críticas. Revisar mensualmente con datos de Langfuse.
2. **Nada entra en producción sin traza.** Langfuse se despliega en F1, antes que cualquier automatización.
3. **Ninguna acción irreversible sin confirmación humana** hasta que la suite de evals demuestre fiabilidad por tipo de acción.
4. **Revisión trimestral del stack:** el ecosistema (MCP, Managed Agents, memoria de agentes) se mueve rápido; las decisiones "Won't" y los aplazamientos (Qdrant, Graphiti, Temporal) se reevalúan con datos, no con hype.
5. **Las 3 decisiones pendientes del usuario** (wiki, grado de self-hosting, presupuesto de tokens) bloquean el inicio de F0 — están formuladas en `00-RESUMEN-EJECUTIVO.md §5`.
