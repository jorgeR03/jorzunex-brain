# scheduled/

Scripts standalone que no corren dentro del gateway HTTP (`server.ts`) ni del
CLI (`cli.ts`), sino disparados por un scheduler externo. Primer y único
script por ahora: **informe semanal** (Jarvis pilar 2 — ver `docs/VISION.md`
y `docs/adr/ADR-0003-atlas-asistente-unificado.md` punto 10).

Decisión explícita de Jorge: esto se dispara con el **Programador de tareas
de Windows**, NO con Anthropic Managed Agents — cero infraestructura nueva
para un PoC de bajo presupuesto.

## Qué hace `weeklyBriefing.ts`

1. Recorre cada carpeta bajo `PROJECTS_ROOT` (por defecto
   `C:/Users/jorge/ProyectosJorZunex`, o `DEV_AGENT_PROJECTS_ROOT` si está
   seteado), excluyendo este propio repo ("Cerebro JorZunex"), y para cada
   una que sea un repo git corre `git log --since="7 days ago" --oneline`.
2. Lee las entradas de los últimos 7 días de
   `docs/wiki/proyectos/_actividad-dev/*.md` y
   `docs/wiki/proyectos/_actividad-comercial/*.md` (esta segunda carpeta
   puede no existir todavía — se ignora sin error).
3. Revisa cuándo se modificó por última vez cada página de
   `docs/wiki/proyectos/*.md` (señal de wiki desactualizada).
4. Envía todo ese texto en una única llamada al Claude Agent SDK (modelo
   resuelto vía `resolveModel({ task: "default" })` → Sonnet 5, sin
   herramientas) pidiendo un resumen de la semana + 3-5 sugerencias
   proactivas.
5. Escribe el resultado en `docs/wiki/briefings/<YYYY-MM-DD>.md` (se crea la
   carpeta si falta). Ese directorio vive bajo `docs/`, así que el watcher de
   ingesta existente lo re-indexa solo — el informe queda consultable por RAG
   como cualquier otro documento de la wiki.

Un repo sin `.git`, o un `git log` que falle en un proyecto puntual, es un
aviso (`console.warn`) que no detiene el resto del informe. Solo un fallo
llamando a la API de Claude (o que no devuelva contenido) es fatal
(`process.exitCode = 1`).

## Probarlo manualmente

Desde `gateway/`, con el `.env` de siempre presente (necesita
`ANTHROPIC_API_KEY`):

```bash
npm run briefing:weekly
```

Revisa el archivo nuevo en `docs/wiki/briefings/<hoy>.md`.

## Registrarlo en el Programador de tareas de Windows

**Nota:** esto es un cambio de configuración del sistema — no lo ejecutes
por mí; corre estos pasos tú mismo (o pide confirmación antes) según la
política de "acciones irreversibles → confirmación humana siempre".

`schtasks` tiene problemas conocidos para anidar comillas cuando el comando
necesita además hacer `cd` a una ruta con espacios (como
`Cerebro JorZunex`). La forma más simple y confiable es un pequeño `.cmd` de
un solo nivel de comillas:

1. Crea `gateway/run-weekly-briefing.cmd` (ruta exacta:
   `C:\Users\jorge\ProyectosJorZunex\Cerebro JorZunex\gateway\run-weekly-briefing.cmd`)
   con este contenido:

   ```bat
   @echo off
   cd /d "C:\Users\jorge\ProyectosJorZunex\Cerebro JorZunex\gateway"
   npm run briefing:weekly >> "C:\Users\jorge\ProyectosJorZunex\Cerebro JorZunex\gateway\logs\weekly-briefing.log" 2>&1
   ```

   Crea también la carpeta `gateway/logs/` si no existe (para que la
   redirección `>>` no falle).

2. Registra la tarea (una vez por semana, lunes a las 08:00 — ajusta
   `/d` y `/st` a tu gusto):

   ```bat
   schtasks /create /tn "JorZunexBrain_WeeklyBriefing" /tr "\"C:\Users\jorge\ProyectosJorZunex\Cerebro JorZunex\gateway\run-weekly-briefing.cmd\"" /sc weekly /d MON /st 08:00
   ```

3. Verifica que quedó creada:

   ```bat
   schtasks /query /tn "JorZunexBrain_WeeklyBriefing"
   ```

4. Para probar la tarea ya registrada sin esperar al lunes:

   ```bat
   schtasks /run /tn "JorZunexBrain_WeeklyBriefing"
   ```

Estos comandos son para `cmd.exe` (Símbolo del sistema), no PowerShell — si
los corres desde PowerShell, ejecuta antes `cmd /c` o ábrelos en un cmd.exe
normal para evitar que PowerShell reinterprete las comillas.
