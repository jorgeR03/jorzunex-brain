# ADR-0002 — Estrategia de asistente de voz

- **Fecha:** 2026-07-29
- **Estado:** Aceptada
- **Requisito de Jorge:** "procura que se pueda convertir en asistente con voz y toda la cosa", con presupuesto bajo.

## Contexto

Claude no tiene entrada/salida de voz nativa en el API: la voz es una capa de canal (STT → texto → gateway → texto → TTS). La arquitectura ya aísla los canales tras la interfaz `Channel`, así que la voz es un canal más — no cambia el núcleo.

## Decisión: 3 escalones, empezando por el gratuito

### Escalón A — Voz en el navegador (coste 0€, Fase 2 de la web UI)
- **STT:** Web Speech API (`SpeechRecognition`) del navegador — gratis, soporta español, funciona en Chrome/Edge/Android.
- **TTS:** `speechSynthesis` del navegador — gratis, voces es-ES incluidas en el sistema.
- Implementación: botón de micrófono en la web UI (Next.js); el audio nunca sale del navegador, solo viaja texto al gateway → cero coste añadido y latencia mínima.
- Limitación aceptada: calidad de voz "de sistema", requiere navegador compatible.

### Escalón B — Voz self-hosted (coste 0€ sobre el VPS ya pagado)
Cuando el escalón A se quede corto (notas de voz de WhatsApp, apps móviles, calidad):
- **STT:** `faster-whisper` (modelo small/medium, CPU del VPS) — open source, excelente en español.
- **TTS:** **Piper** — open source, voces es_ES/es_MX gratuitas, tiempo real en CPU.
- Ambos como microservicio `voice/` en el VPS, detrás del gateway.
- Este escalón habilita las **notas de voz de WhatsApp**: audio Twilio → faster-whisper → gateway → Piper → audio de respuesta.

### Escalón C — Voz premium / tiempo real (pagado, solo si el negocio lo justifica)
- STT streaming: Deepgram (~$0,006/min). TTS de calidad: ElevenLabs (~$5/mes entrada). Conversación full-duplex: LiveKit Agents (open source) como orquestador de sala.
- No se adopta ahora; queda documentado como ruta de escalado.

## Impacto en el diseño (obligatorio para quien implemente)

1. La interfaz `Channel` debe soportar payloads de audio además de texto desde su primera versión (aunque el primer canal de voz sea solo navegador).
2. El gateway responde en **texto plano estructurado apto para TTS** cuando el canal es de voz (frases cortas, sin Markdown/tablas): añadir un flag `outputMode: "voice" | "text"` que ajuste el prompt de sistema.
3. Latencia objetivo para voz: primera palabra < 2s → usar streaming del API + `claude-haiku-4-5`/`claude-sonnet-5` en interacciones de voz (nunca Opus/Fable por defecto).

## Consecuencias

- Voz utilizable con 0€ adicionales en cuanto exista la web UI (F2).
- Ninguna dependencia de proveedor de voz en el núcleo: STT/TTS son adaptadores intercambiables.
