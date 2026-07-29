# gateway/ — Brain Gateway (PoC-1 → producción)

Núcleo del Brain sobre **Claude Agent SDK** (TypeScript, `@anthropic-ai/claude-agent-sdk`).

**Qué va aquí:** router de peticiones, `ModelRouter` (política de ADR-0001 §3 — Sonnet default, Haiku bulk, Opus por flag, Fable 5 desactivado), hooks de permisos/auditoría, persistencia de conversaciones en Postgres, interfaces `Retriever`/`Channel`/`MemoryStore`.

**Primera tarea (PoC-1):** CLI `brain ask "<pregunta>"` que responde usando los Markdown de `/docs` y `/prompts` vía herramientas nativas del SDK, con log en Postgres local (docker-compose de `/infra`). Criterios de éxito en `docs/investigacion/05-roadmap-pocs-backlog.md`.

No hardcodear modelos fuera del ModelRouter. Manejar `stop_reason: "refusal"`.
