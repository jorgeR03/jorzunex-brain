# Cerebro JorZunex

Sistema operativo interno con IA de JorZunex ("JorZunex Brain"): memoria permanente, centro de conocimiento, automatizaciones, agentes y asistente de desarrollo/negocio para todo el equipo.

## ⚠️ LEE ESTO PRIMERO

**Estado del proyecto: investigación completada, decisiones tomadas, listo para PoC-1.** Antes de escribir cualquier código de producto, lee **obligatoriamente y en este orden**:

1. `docs/investigacion/07-GUIA-PARA-AGENTES-CLAUDE.md` ← **la guía operativa paso a paso para ti**; su §7 dice EXACTAMENTE qué hacer en la próxima sesión
2. `docs/VISION.md` ← el norte: "Jarvis de JorZunex" (memoria total + proactivo con voz + generador de ingresos)
3. `docs/adr/` ← decisiones vinculantes (ADR-0001 presupuesto/hosting/wiki, ADR-0002 voz)
4. `docs/investigacion/00-RESUMEN-EJECUTIVO.md` ← stack decidido

El resto de la investigación (fases 1–10 del estudio) está en `docs/investigacion/01…06`.

**Presupuesto bajo (vinculante):** trabaja con el modelo del plan (Sonnet 5 recomendado); NO uses Fable 5 (gasta créditos) ni Opus salvo bloqueo real. En el código, ModelRouter según ADR-0001 §3.

## Reglas rápidas

- Idioma con el usuario: **español**. Código e identificadores: inglés.
- **No reinventar la rueda:** 80–90% herramientas existentes (stack cerrado en el resumen ejecutivo); código propio solo gateway, canales y prompts/políticas.
- Modelo por defecto `claude-sonnet-5` (ver ADR-0001 §3); `claude-opus-5`/`claude-fable-5` solo con autorización explícita vía ModelRouter. Nunca hardcodear modelos fuera del ModelRouter.
- Acciones irreversibles → confirmación humana siempre.
- Credenciales solo en variables de entorno / vaults; jamás en prompts o código.
- Al terminar una sesión de trabajo: actualiza la tabla "Estado vivo" al final de `07-GUIA-PARA-AGENTES-CLAUDE.md`.

## Stack decidido (resumen)

Claude API + Claude Agent SDK (gateway) + Managed Agents (cron) · MCP como bus de integración · Outline/Notion (wiki, pendiente decisión) · PostgreSQL + pgvector · n8n · Langfuse · GitHub + Linear · Clerk · Coolify (VPS) + Vercel · Graphiti y Qdrant aplazados a fase 2/escala.
