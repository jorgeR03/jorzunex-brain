-- Cerebro JorZunex — esquema inicial de persistencia (PoC-1)
--
-- Se aplica automáticamente al primer arranque de Postgres vía
-- docker-entrypoint-initdb.d (ver infra/docker-compose.yml). Para aplicarlo
-- a mano contra una base ya existente:
--   psql "$DATABASE_URL" -f gateway/sql/001_init.sql

CREATE EXTENSION IF NOT EXISTS vector;

-- Cada fila = una interacción completa con el gateway (una pregunta -> una
-- respuesta), independientemente del canal de entrada.
CREATE TABLE IF NOT EXISTS conversations (
    id                 BIGSERIAL PRIMARY KEY,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    channel            TEXT NOT NULL,              -- 'cli', 'web', 'slack', 'whatsapp', ...
    task_type          TEXT NOT NULL,               -- tarea pasada al ModelRouter ('default', 'classify', ...)
    model              TEXT NOT NULL,               -- modelo real resuelto por el ModelRouter
    question           TEXT NOT NULL,
    answer             TEXT NOT NULL,
    tools_used         JSONB NOT NULL DEFAULT '[]', -- nombres de herramientas invocadas
    citations          JSONB NOT NULL DEFAULT '[]', -- rutas de archivo citadas en la respuesta
    input_tokens       INTEGER NOT NULL DEFAULT 0,
    output_tokens      INTEGER NOT NULL DEFAULT 0,
    cache_read_tokens  INTEGER NOT NULL DEFAULT 0,
    cache_write_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
    stop_reason        TEXT,
    is_error           BOOLEAN NOT NULL DEFAULT false,
    error_message      TEXT,
    duration_ms        INTEGER,
    metadata           JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_channel ON conversations (channel);
CREATE INDEX IF NOT EXISTS idx_conversations_model ON conversations (model);

-- Reservado para PoC-2 (ingesta RAG): fragmentos de documentos + embeddings.
-- Se crea aquí para no exigir una segunda migración manual, pero no se usa
-- todavía en PoC-1.
CREATE TABLE IF NOT EXISTS document_chunks (
    id          BIGSERIAL PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_path TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content     TEXT NOT NULL,
    embedding   vector(1536),
    metadata    JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_source ON document_chunks (source_path);
