# ingest/ — Pipelines RAG (PoC-2)

Ingesta de conocimiento → chunking → embeddings → `pgvector`.

Fuentes fase 1: Markdown del repo (`/docs`, `/prompts`). Fase 2: Outline export, Google Drive (vía n8n).
El retrieval se consume SIEMPRE a través de la interfaz `Retriever` del gateway — nunca acceso directo a pgvector desde lógica de negocio (permite migrar a Qdrant sin tocar consumidores).
