# channels/cli/ — Canal CLI (PoC-1)

Primer canal implementado, según el orden de `channels/README.md`. Es el canal
de referencia: cualquier canal futuro (web, Slack, WhatsApp, voz) debe
implementar la misma interfaz `Channel` (`gateway/src/channels/types.ts`) que
usa este.

## Comando

El binario vive en `gateway/` (paquete `@jorzunex/brain-gateway`, bin `brain`).

```bash
cd gateway
npm install          # una vez
cp .env.example .env # y rellena ANTHROPIC_API_KEY si no usas el login de Claude Code

# Modo desarrollo (sin compilar), vía tsx:
npm run ask -- ask "¿Qué base vectorial elegimos y por qué?"

# O compilado:
npm run build
node dist/cli.js ask "¿Qué base vectorial elegimos y por qué?"
```

### Sintaxis

```
brain ask "<pregunta>" [opciones]

--voice             outputMode "voice": frases cortas, sin Markdown (ADR-0002).
--task <tipo>       default | classify | route | extract | bulk | agentic | critical
--allow-opus        Autoriza claude-opus-5 (solo con --task agentic).
--allow-fable       Autoriza claude-fable-5 (DESACTIVADO por defecto — ADR-0001 §3).
--channel <nombre>  Nombre de canal registrado en la interacción (por defecto "cli").
```

## Cómo mapea a la interfaz `Channel`

Este canal es el caso más simple de `Channel`: `outputMode` fijo a `"text"`
salvo que se pase `--voice`, sin `userId` (proceso interactivo de un único
usuario), y el `payload` es siempre texto (nunca `audio` — ese campo está
reservado para canales futuros como WhatsApp, ver ADR-0002 escalón B).

```ts
import type { Channel, ChannelRequest, ChannelOutputPayload } from "../../gateway/src/channels/types.js";
import { askBrain } from "../../gateway/src/gateway.js";

export const cliChannel: Channel = {
  name: "cli",
  outputMode: "text",
  async handle(request: ChannelRequest): Promise<ChannelOutputPayload> {
    const result = await askBrain({
      question: request.payload.text ?? "",
      channel: "cli",
      outputMode: request.outputMode,
    });
    return {
      text: result.answer,
      citations: result.citations,
      toolsUsed: result.toolsUsed,
    };
  },
};
```

(`gateway/src/cli.ts` no pasa por este wrapper todavía — llama a `askBrain`
directamente por simplicidad de PoC-1. Este objeto documenta la forma que
tendrá cuando haya más de un canal y convenga centralizar el dispatch.)

## Próximos canales (orden del roadmap)

`web/` (Next.js + Clerk + voz de navegador) → `slack/` → `whatsapp/` (Twilio,
notas de voz) → `voice/` (STT/TTS self-hosted). Ver `channels/README.md`.
