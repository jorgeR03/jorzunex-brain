# infra/ — Infraestructura

Fase local (actual, coste 0€): `docker-compose.yml` levanta 3 servicios — Postgres+pgvector (Brain), n8n (automatización) y el stack completo de Langfuse (observabilidad). Fase VPS: misma configuración, desplegada vía Coolify (Hetzner, ver `docs/adr/ADR-0001-decisiones-fundacionales.md` §2). No añadir servicios que el roadmap no pida.

## Arranque

```bash
cd infra
cp .env.example .env      # opcional en local — los defaults ya sirven para desarrollar
docker compose up -d
docker compose ps          # todos deben quedar "healthy" (Langfuse web/worker tardan ~30-40s en arrancar tras las migraciones)
```

## Servicios y cómo acceder

| Servicio | URL | Primer acceso |
|---|---|---|
| **Postgres del Brain** | `localhost:5432` (o `$POSTGRES_PORT`) | Usado por el gateway (`gateway/.env`), no por navegador |
| **n8n** | http://localhost:5678 | Pantalla de "crear cuenta owner" en el primer arranque |
| **Langfuse** | http://localhost:3000 | Pantalla de "sign up" en el primer arranque — crea tu usuario admin ahí |
| MinIO (consola, uso interno de Langfuse) | http://localhost:9091 | Usuario/clave en `infra/.env` (`LANGFUSE_MINIO_ROOT_*`) — normalmente no hace falta entrar aquí a mano |

## Por qué Langfuse necesita 4 piezas (Postgres, ClickHouse, Redis, MinIO)

En la versión actual (`langfuse:3`), estas 4 piezas son **obligatorias**, no opcionales: Postgres guarda usuarios/proyectos/API keys (transaccional), ClickHouse guarda las trazas (OLAP, alto volumen), Redis maneja las colas de ingesta, y MinIO (compatible S3) guarda eventos y medios. Se aísla el Postgres de Langfuse del Postgres del Brain a propósito — un problema en uno no afecta al otro.

## Pendiente

- El gateway todavía **no está conectado** a Langfuse (falta el paso de código en `gateway/`, vía OpenTelemetry) — los servicios están arriba y listos, pero de momento no reciben trazas reales.
- n8n no tiene flujos configurados todavía (F2: pendiente definir 3-5 flujos reales con Jorge).
