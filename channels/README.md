# channels/ — Canales de entrada/salida

Cada canal implementa la interfaz `Channel` del gateway (texto Y audio desde v1 — ver ADR-0002).

Orden de implementación: `cli/` (PoC-1) → `web/` (Next.js + Clerk + voz de navegador, ADR-0002 escalón A) → `slack/` → `whatsapp/` (Twilio; incluye notas de voz con faster-whisper/Piper, escalón B) → `voice/` (microservicio STT/TTS self-hosted).

Los canales de voz usan `outputMode: "voice"` (frases cortas, sin Markdown) y modelos rápidos (Haiku/Sonnet).
