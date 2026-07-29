# MCP compartido del proyecto — `.mcp.json`

> Configura los servidores MCP (Model Context Protocol) que **cualquier sesión de Claude Code abierta en este repo** tiene disponibles automáticamente (previa aprobación de confianza del workspace, ver §4). Ver paso `3.1.4` de `docs/investigacion/07-GUIA-PARA-AGENTES-CLAUDE.md`.
>
> **Última verificación:** 2026-07-29, sesión Sonnet 5. Todo lo que este documento afirma que "funciona" fue ejecutado y su salida inspeccionada (regla de la guía §4.8) — ver transcripciones en §3.

## 1. Servidores configurados

| Servidor | Tipo | Transporte | Alcance | Estado |
|---|---|---|---|---|
| `github` | HTTP remoto oficial | Streamable HTTP (`https://api.githubcopilot.com/mcp/`) | Toda la API de GitHub (repos, issues, PRs...) según el token | Configurado; **falta `GITHUB_TOKEN`** |
| `postgres` | Paquete npm oficial (archivado) vía stdio | `npx -y @modelcontextprotocol/server-postgres <connection-string>` | Solo lectura SQL contra la BD local `jorzunex_brain` | Configurado y **probado en vivo** contra el contenedor local |
| `filesystem` | Paquete npm oficial vía stdio | `npx -y @modelcontextprotocol/server-filesystem <docs> <prompts>` | Acotado a `docs/` y `prompts/` del repo | Configurado y **probado en vivo** |

Archivo: `.mcp.json` en la raíz del repo (formato `{"mcpServers": {...}}` de Claude Code, ver [docs oficiales](https://code.claude.com/docs/en/mcp)).

### 1.1 Por qué el GitHub server es remoto y no el paquete npm

El paquete `@modelcontextprotocol/server-github` que pedía la tarea original está **deprecado/archivado** (npm lo marca `DEPRECATED ⚠️ Package no longer supported`, y el repo `modelcontextprotocol/servers` lo movió a `servers-archived` sin sustituto oficial). Igual pasa con `@modelcontextprotocol/server-postgres`. Por eso:

- **GitHub:** usamos el servidor remoto oficial mantenido por GitHub mismo (`https://api.githubcopilot.com/mcp/`), que es la opción vigente y soportada.
- **Postgres:** no existe un reemplazo "oficial" de Anthropic/GitHub para MCP+Postgres a día de hoy. El paquete archivado **sigue funcionando** (lo verificamos en vivo, §3.2) y es la opción más simple sin añadir una dependencia de terceros no auditada. Si en el futuro aparece un sucesor oficial, hay que migrar `.mcp.json` (issue a vigilar; no bloquea nada ahora).

## 2. Variables de entorno necesarias

`.mcp.json` usa expansión `${VAR}` / `${VAR:-default}`, que Claude Code resuelve **del entorno de shell de la sesión** (no lee `gateway/.env` automáticamente — son sistemas distintos).

| Variable | Servidor | Obligatoria | Cómo se obtiene |
|---|---|---|---|
| `GITHUB_TOKEN` | `github` | Sí, para que el servidor responda (401 sin ella) | Personal Access Token de GitHub (scopes mínimos según lo que se vaya a usar: `repo`, `read:org` si hace falta). **No lo generamos nosotros** — pídeselo a Jorge o que lo cree él en https://github.com/settings/tokens y lo exporte en su perfil de shell (`export GITHUB_TOKEN=...` en `~/.bashrc`/`~/.zshrc`, o variable de usuario en Windows) **antes** de abrir Claude Code. Nunca en el repo ni en prompts. |
| `DATABASE_URL` | `postgres` | No — hay valor por defecto | Si no está definida, usa `postgresql://brain:brain_dev_password@localhost:5432/jorzunex_brain`, que coincide con los defaults ya versionados en `infra/docker-compose.yml` y `gateway/.env.example` (no es un secreto real, es la contraseña de desarrollo local). Si Jorge cambia las credenciales de Postgres, debe exportar `DATABASE_URL` con el valor nuevo. |
| `CLAUDE_PROJECT_DIR` | `filesystem` | No | La define Claude Code automáticamente al cargar un `.mcp.json` de proyecto; el fallback `:-.` es solo un colchón si se invocara fuera de ese contexto. |

Si `GITHUB_TOKEN` no está definida, Claude Code **no bloquea el arranque**: `claude mcp list` muestra una advertencia (`Missing environment variables: GITHUB_TOKEN`) y dentro de la sesión el servidor `github` funcionará hasta que alguien intente usarlo (entonces la llamada HTTP fallará con 401).

## 3. Verificación realizada (no destructiva)

### 3.1 Filesystem — handshake MCP real

```
$ printf '...initialize...\n...notifications/initialized...\n...tools/list...' \
  | npx -y @modelcontextprotocol/server-filesystem "<repo>/docs" "<repo>/prompts"

{"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{"listChanged":true}},
"serverInfo":{"name":"secure-filesystem-server","version":"0.2.0"}},"jsonrpc":"2.0","id":1}
{"result":{"tools":[read_file, read_text_file, read_media_file, read_multiple_files,
write_file, edit_file, create_directory, list_directory, list_directory_with_sizes,
directory_tree, move_file, search_files, get_file_info, list_allowed_directories]}, ...}
```

Confirmado: arranca, acepta el `initialize` de MCP y lista sus 14 tools con el scope acotado a `docs/` y `prompts/`.

**Aviso importante:** este servidor **no es de solo lectura** — incluye `write_file`, `edit_file`, `move_file`, `create_directory`. El paquete oficial no tiene un flag `--read-only`; el único control real es la lista de directorios permitidos (ya acotada a `docs/` y `prompts/`, nunca a `gateway/`, `ingest/` o `infra/`). Si más adelante se quiere reforzar "solo lectura del conocimiento" al pie de la letra (mismo principio que ya sigue el gateway con `settingSources: []`), la vía es denegar esas tools concretas vía permisos de Claude Code (`.claude/settings.json` → `permissions.deny`, ej. `"mcp__filesystem__write_file"`) — no implementado en esta sesión por no tocar la config de permisos sin que el usuario lo pida explícitamente.

### 3.2 Postgres — handshake + `tools/list` contra la BD real

Contenedor confirmado corriendo con `docker ps` (no se tocó, solo se consultó): `jorzunex-brain-postgres`, imagen `pgvector/pgvector:pg16`, puerto `5432`, `Up ... (healthy)`.

```
$ npx -y @modelcontextprotocol/server-postgres \
  "postgresql://brain:brain_dev_password@localhost:5432/jorzunex_brain" < initialize+tools_list

{"result":{"protocolVersion":"2024-11-05","capabilities":{"resources":{},"tools":{}},
"serverInfo":{"name":"example-servers/postgres","version":"0.1.0"}},"jsonrpc":"2.0","id":1}
{"result":{"tools":[{"name":"query","description":"Run a read-only SQL query", ...}]},
"jsonrpc":"2.0","id":2}
```

Confirmado: conecta de verdad contra el Postgres local del proyecto y expone una tool `query` de solo lectura.

### 3.3 GitHub — alcance del endpoint remoto

```
$ curl -X POST https://api.githubcopilot.com/mcp/ -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" -d '{"jsonrpc":"2.0", "method":"initialize", ...}'

HTTP 401 — "bad request: missing required Authorization header"
```

Confirmado: el endpoint existe, responde protocolo MCP y exige `Authorization` (esperado sin token — no se intentó autenticar sin credenciales, no se inventó ningún token).

### 3.4 `.mcp.json` validado por Claude Code

```
$ claude mcp list
...
github: https://api.githubcopilot.com/mcp/ (HTTP) - ⏸ Pending approval (run `claude` to approve)
postgres: npx -y @modelcontextprotocol/server-postgres ${DATABASE_URL:-...} - ⏸ Pending approval
filesystem: npx -y @modelcontextprotocol/server-filesystem ${CLAUDE_PROJECT_DIR:-.}/docs ... - ⏸ Pending approval

[Warning] [github] mcpServers.github: Missing environment variables: GITHUB_TOKEN
```

El JSON es válido, los 3 servidores se detectan y solo falta la aprobación de confianza (manual, ver §4) y el token de GitHub.

## 4. Cómo probarlo tú (Jorge) desde una sesión de Claude Code

1. Abre una sesión de Claude Code en la raíz del repo (`claude`).
2. La primera vez, Claude Code pedirá **confiar en el workspace** porque hay servidores nuevos en `.mcp.json` — acéptalo (o los servidores quedarán `⏸ Pending approval` para siempre).
3. Dentro de la sesión, ejecuta `/mcp` para ver el panel con los 3 servidores y su estado (`✔ Connected`, `! Needs authentication`, `✘ Failed to connect`).
4. Desde terminal también puedes usar `claude mcp list` y `claude mcp get <nombre>` para ver detalle de cada uno.
5. Para `github`: exporta `GITHUB_TOKEN` en tu shell **antes** de abrir Claude Code y vuelve a comprobar con `claude mcp list` (el aviso de variable faltante debería desaparecer).
6. Para `postgres`: si `infra/docker-compose.yml` no está levantado (`docker compose up -d` desde `infra/`), el servidor quedará `✘ Failed to connect` — no es un problema de configuración, es que la BD no está arriba. Ahora mismo (2026-07-29) **sí está corriendo** (`jorzunex-brain-postgres`, healthy).
7. Si quieres resetear aprobaciones (por ejemplo tras editar `.mcp.json`): `claude mcp reset-project-choices`.

## 5. Pendiente / no bloqueante

- **`GITHUB_TOKEN`**: no se generó ni se pidió de forma bloqueante. Jorge debe crear un PAT de GitHub y exportarlo en su entorno de shell (no en el repo).
- **Aprobación interactiva del workspace**: el harness de esta sesión no tiene TTY interactivo, así que no se pudo ejecutar el paso de "confiar en el workspace" que deja los servidores en `✔ Connected` dentro de una sesión real. Se verificó la funcionalidad subyacente directamente (§3.1–3.3) en su lugar; el paso de aprobación queda para la primera sesión interactiva de Jorge (§4, paso 2).
- **Postgres**: hoy está arriba y probado; si en una sesión futura el contenedor no está corriendo, basta `docker compose up -d` en `infra/` (no se tocó ese archivo en esta tarea, solo se leyó).
- **Filesystem no es read-only de verdad** (ver aviso en §3.1): documentado, sin cambios en permisos porque no se pidió explícitamente.
- **Vigilar**: si `@modelcontextprotocol/server-postgres` desaparece de npm (está archivado, no solo deprecado en el sentido de "hay sucesor"), habrá que elegir un servidor de Postgres MCP mantenido por la comunidad y registrar el cambio en un ADR.
