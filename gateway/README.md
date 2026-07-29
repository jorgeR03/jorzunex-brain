# gateway/ — Brain Gateway (PoC-1 + PoC-2)

Núcleo del Brain de JorZunex sobre **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`, TypeScript).

## Qué hay implementado

- **CLI `brain ask "<pregunta>"`** (`src/cli.ts`): recupera primero contexto
  relevante vía RAG (`Retriever` sobre pgvector) y lo pasa como fuente
  principal; además mantiene acceso de **solo lectura** (Read/Glob/Grep,
  nunca Write/Edit/Bash) a los Markdown de `/docs` y `/prompts` del repo como
  respaldo/verificación. Responde en español citando los archivos usados.
- **`ModelRouter`** (`src/modelRouter.ts`): única fuente de verdad de qué modelo
  se usa por tarea, según ADR-0001 §3. Ningún otro módulo debe escribir un
  string `"claude-..."` a mano.
- **Persistencia dual** (`src/persistence/`): cada interacción (pregunta,
  respuesta, herramientas, tokens, coste estimado, modelo, si usó RAG y qué
  fragmentos) se guarda en Postgres (preferido) o, si no está disponible, en
  un JSONL local (`data/conversations.jsonl`, gitignored) — sin bloquear
  nunca al usuario.
- **Interfaz `Channel`** (`src/channels/types.ts`): contrato común para
  cualquier canal (CLI, web, Slack, WhatsApp), con soporte de audio y
  `outputMode: "voice" | "text"` desde el diseño inicial (ADR-0002).
- **RAG (PoC-2)** — ingesta + retrieval sobre `docs/` y `prompts/`:
  - **`Embedder`** (`src/embedder/`): interfaz + implementación local y
    gratuita con `@xenova/transformers` (modelo
    `Xenova/paraphrase-multilingual-MiniLM-L12-v2`, 384 dim, corre en CPU,
    sin API externa ni coste — ADR-0001 §3 no permite proveedores de pago
    para esto).
  - **Ingesta** (`src/ingest/`, `npm run ingest`): recorre `docs/` y
    `prompts/`, trocea cada Markdown por encabezados + ventanas solapadas de
    ~400 palabras, genera embeddings y los guarda en `document_chunks`
    (reemplazo idempotente por archivo). Script standalone — no usa n8n
    todavía (no está desplegado).
  - **`Retriever`** (`src/retriever/`): interfaz + implementación pgvector
    (similaridad coseno, top-k). Ningún consumidor habla con Postgres
    directamente.

## Puesta en marcha

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
fallback JSONL automáticamente (`BRAIN_STORAGE_BACKEND=auto`) — pero el RAG
(ingesta/retrieval) SÍ necesita Postgres+pgvector; sin él, `brain ask` cae
automáticamente al acceso Read/Glob/Grep de solo lectura (sin RAG).

### 3. Ingestar el conocimiento (una vez, y cada vez que cambie docs/prompts)

```bash
npm run ingest
```

Recorre `docs/` y `prompts/`, genera embeddings locales y los guarda en
`document_chunks`. Tarda ~20-50s (la primera vez incluye descargar el modelo
de Hugging Face, ~100MB, gratis). Reingestar es seguro: reemplaza los
chunks de cada archivo sin duplicar.

## Uso

```bash
npm run ask -- ask "¿Qué base vectorial elegimos y por qué?"

# Opciones:
#   --voice            outputMode "voice" (frases cortas, sin Markdown)
#   --task <tipo>      default|classify|route|extract|bulk|agentic|critical
#   --allow-opus       autoriza claude-opus-5 (requiere --task agentic)
#   --allow-fable      autoriza claude-fable-5 (DESACTIVADO por defecto)
#   --channel <nombre> canal de origen registrado en la interacción
#   --no-rag           desactiva el Retriever (solo Read/Glob/Grep)
#   --top-k <n>        nº de fragmentos a recuperar (por defecto 6)
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
