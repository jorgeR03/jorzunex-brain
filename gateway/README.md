# gateway/ — Brain Gateway (PoC-1)

Núcleo del Brain de JorZunex sobre **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`, TypeScript).

## Qué hay implementado (PoC-1)

- **CLI `brain ask "<pregunta>"`** (`src/cli.ts`): llama a `query()` del Agent SDK
  con acceso de **solo lectura** (Read/Glob/Grep, nunca Write/Edit/Bash) a los
  Markdown de `/docs` y `/prompts` del repo — ese es el conocimiento del Brain.
  Responde en español citando los archivos usados.
- **`ModelRouter`** (`src/modelRouter.ts`): única fuente de verdad de qué modelo
  se usa por tarea, según ADR-0001 §3. Ningún otro módulo debe escribir un
  string `"claude-..."` a mano.
- **Persistencia dual** (`src/persistence/`): cada interacción (pregunta,
  respuesta, herramientas, tokens, coste estimado, modelo) se guarda en
  Postgres (preferido) o, si no está disponible, en un JSONL local
  (`data/conversations.jsonl`, gitignored) — sin bloquear nunca al usuario.
- **Interfaz `Channel`** (`src/channels/types.ts`): contrato común para
  cualquier canal (CLI, web, Slack, WhatsApp), con soporte de audio y
  `outputMode: "voice" | "text"` desde el diseño inicial (ADR-0002).

## Puesta en marcha (2 pasos)

### 1. Instalar dependencias y configurar

```bash
cd gateway
npm install
cp .env.example .env
```

Edita `.env` si hace falta (ver comentarios en `.env.example`). Por defecto
`BRAIN_STORAGE_BACKEND=auto`: intenta Postgres y cae a JSONL si no responde.

### 2. Activar credenciales de Claude

El Claude Agent SDK resuelve la autenticación automáticamente, en este orden:

1. **`ANTHROPIC_API_KEY`** en `.env` (si la defines).
2. **Login de Claude Code ya hecho en esta máquina** (`claude /login` o
   `ant auth login`) — no requiere ninguna variable. Esta es la vía
   recomendada para desarrollo local (usa la cuota del plan de Jorge, no
   gasta crédito de API — ver ADR-0001 §3).

Si ninguna de las dos está disponible, `brain ask` fallará con un error de
autenticación al invocar `query()`. En ese caso: pide a Jorge que ejecute
`claude /login` una vez en esta máquina, o que provea `ANTHROPIC_API_KEY`.

### (Opcional) Levantar Postgres local

```bash
cd ../infra
docker compose up -d
```

Si Docker no está instalado/corriendo, no pasa nada: el gateway usa el
fallback JSONL automáticamente (`BRAIN_STORAGE_BACKEND=auto`).

## Uso

```bash
npm run ask -- ask "¿Qué base vectorial elegimos y por qué?"

# Opciones:
#   --voice            outputMode "voice" (frases cortas, sin Markdown)
#   --task <tipo>      default|classify|route|extract|bulk|agentic|critical
#   --allow-opus       autoriza claude-opus-5 (requiere --task agentic)
#   --allow-fable      autoriza claude-fable-5 (DESACTIVADO por defecto)
#   --channel <nombre> canal de origen registrado en la interacción
```

Compilado (para producción / el binario `brain`):

```bash
npm run build
node dist/cli.js ask "..."
```

## Reglas no negociables (recordatorio)

- Nunca hardcodear modelos fuera de `ModelRouter` (`src/modelRouter.ts`).
- Manejar siempre `stop_reason: "refusal"` con mensaje claro (ver `gateway.ts`).
- Credenciales solo en `.env` / vaults — nunca en prompts ni código.
- Acciones irreversibles → confirmación humana siempre (no aplica todavía en
  PoC-1: el Brain solo lee, no escribe nada).
