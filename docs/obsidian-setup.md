# Obsidian como interfaz del conocimiento (0€)

> Ver `docs/adr/ADR-0001-decisiones-fundacionales.md` §Decisión 1 (actualizada). Obsidian NO reemplaza `docs/wiki/`: es solo una forma más cómoda de leer y editar los mismos archivos Markdown que el Brain ya usa.

## Qué es y por qué

Obsidian es una app gratuita (Windows/Mac/Linux/móvil) que convierte una carpeta de archivos `.md` en una "vault" navegable: editor, enlaces `[[entre notas]]`, vista de grafo, búsqueda. No inventa ningún formato propio — sigue siendo Markdown plano, lo mismo que ya lee el gateway del Brain. Cero coste, cero infraestructura nueva.

## Puesta en marcha (Jorge, 5 minutos)

1. Descarga Obsidian: https://obsidian.md (gratis).
2. "Open folder as vault" → selecciona la carpeta `docs/` de este repo (o `docs/wiki/` si prefieres ver solo el conocimiento de empresa, sin la investigación técnica).
3. Ya puedes navegar, editar y enlazar notas normalmente. Los cambios son archivos `.md` reales en el repo — cualquier `git status` los va a ver.

## Sincronizar con el equipo (gratis, vía Git — no Obsidian Sync)

Obsidian Sync cuesta $4–8/usuario/mes. En vez de eso, usamos el repo git que ya existe:

1. Dentro de Obsidian: **Settings → Community plugins → Browse** → instala **"Obsidian Git"**.
2. Actívalo y configura (Settings del plugin):
   - **Vault backup interval**: cada 10–15 min (auto-commit + push).
   - **Auto pull on Obsidian launch**: activado.
   - **Auto push**: activado.
3. La primera vez, autentícate con tu método git habitual (SSH o token de GitHub) — es el mismo repo, mismas credenciales que ya usas para el proyecto.

Con esto, cualquier persona del equipo con acceso al repo edita en Obsidian y los cambios se sincronizan solos, sin pagar nada.

## Reglas de convivencia con el Brain

- No cambies la estructura de carpetas de `docs/wiki/` (clientes/, proyectos/, procesos/, equipo/, empresa/) sin avisar — el pipeline de ingesta RAG (PoC-2) las recorre por convención.
- Los archivos con nombre `_ejemplo-*.md` son plantillas de ejemplo — bórralos al crear las fichas reales del mismo tipo.
- Evita renombrar archivos ya ingeridos sin necesidad: el RAG los reindexa por ruta; un rename masivo obliga a reingerir todo (no rompe nada, solo hay que volver a correr el pipeline).

## Cuándo reconsiderar Outline

Si el equipo crece más allá de quien puede usar Git/Obsidian cómodamente, o hace falta edición colaborativa en tiempo real (varias personas en el mismo documento a la vez, como Google Docs), reabrir la Decisión 1 del ADR-0001 y desplegar Outline en el VPS (ya estaba evaluado y listo en la investigación, `docs/investigacion/02-comparativa-herramientas.md` §2.1).
