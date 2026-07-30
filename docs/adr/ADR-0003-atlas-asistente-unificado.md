# ADR-0003 — Atlas: de asistente de lectura a asistente unificado (Jarvis)

- **Fecha:** 2026-07-30 (decisiones ⚠️ cerradas el mismo día)
- **Estado:** Aceptada
- **Contexto:** Jorge redefinió la visión del proyecto: no un chatbot con funciones sueltas, sino **una sola inteligencia** (Atlas) que conoce su contexto completo, ejecuta trabajo real, pide autorización cuando corresponde y actúa con autonomía hasta terminar. Este ADR mapea esa visión a la arquitectura ya construida — extendiéndola, no reescribiéndola — y deja explícito el porqué de cada pieza antes de tocar código.

## Incidente que motiva parte de este diseño

Antes de este ADR, se detectó y corrigió un fallo real de seguridad: el primer `devAgent` (capacidad de escritura sobre proyectos) tenía `Bash` en `allowedTools`, lo que **saltaba por completo** el guardarraíl `canUseTool` — un `git push` a un repo real (`GymApp`) se ejecutó sin autorización (cambio inofensivo, una línea de README, pero el principio falló). Corregido: `Write`/`Edit`/`Bash` NUNCA van en `allowedTools`; SIEMPRE se deciden vía `canUseTool`. Verificado en un repo de prueba aislado (sin remoto real): bloqueo confirmado sin autorización, ejecución confirmada con autorización explícita. Este ADR generaliza ese mismo patrón (autorizar una vez → ejecutar sin fricción) a **toda** acción sensible, no solo a despliegues de código.

## Principio rector

**Un solo Atlas, muchas capacidades detrás.** El usuario nunca elige "modo lectura" vs "modo desarrollador" vs "modo agenda" — le habla a Atlas, y un **orquestador** dentro del gateway decide qué capacidad(es) usar. Las capacidades ya construidas (RAG de solo lectura, dev-agent de escritura) y las nuevas (búsqueda web, agenda, documentos, más workspaces) son *herramientas* del mismo agente, no productos separados.

## Mapa: petición de Jorge → decisión de arquitectura

| # | Lo que pidió Jorge | Cómo encaja en lo ya construido | Qué falta construir |
|---|---|---|---|
| 1 | Obsidian como fuente principal, consultado de forma natural, mantenido actualizado | `docs/wiki/` YA ES la vault de Obsidian (mismo archivo). El `Retriever` (PoC-2, pgvector) ya la indexa. | (a) Re-ingesta automática al detectar cambios (watcher de archivos), no `npm run ingest` manual. (b) Permitir que Atlas **escriba** de vuelta a `docs/wiki/` cuando aprenda algo nuevo — mismo guardarraíl `canUseTool` que el dev-agent, pero con alcance limitado a esa carpeta |
| 2 | Ejecutar trabajo real, procesos largos sin supervisar cada paso | `devAgent.ts` ya prueba que el patrón funciona (Agent SDK con Write/Edit/Bash + guardarraíl) | Pasar de **petición síncrona** (`POST /dev-task` bloquea hasta terminar) a **trabajos asíncronos**: se lanza, devuelve un ID, corre en segundo plano, se consulta progreso o se notifica al terminar. Necesita una tabla `jobs` en Postgres + un endpoint de estado |
| 3 | Pedir autorización SIEMPRE que la acción modifique info/procesos importantes/recursos sensibles; una vez aprobada, ejecutar todo sin más fricción | Es EXACTAMENTE el patrón `canUseTool` ya construido y verificado (git push bloqueado sin autorización, permitido con ella) | Generalizar el clasificador de "acción sensible" más allá de git push/deploy: enviar email/WhatsApp, gastar dinero, borrar datos, contactar clientes — misma mecánica, más patrones |
| 4 | Memoria y contexto de todos los proyectos, relacionar info entre ellos, continuidad entre conversaciones | El corpus RAG ya cubre los 11 proyectos (fichas en `docs/wiki/proyectos/`) | (a) Indexar más profundo cada proyecto (sus propios README/docs, no solo el resumen). (b) **Memoria de conversación entre turnos** — hoy cada llamada a `/ask` es independiente; falta un concepto de "sesión" que se persista y se reinyecte como contexto |
| 5 | Buscar en conocimiento personal primero; si no está, buscar fuentes externas | El RAG (Retriever) ya hace la primera parte | Habilitar `WebSearch`/`WebFetch` en `askBrain` (hoy explícitamente bloqueadas) como respaldo cuando el RAG no tenga la respuesta — sigue siendo de solo lectura, no cambia el perfil de riesgo |
| 6 | Distintos "espacios de trabajo" (tu computador vs el de José), cambio natural entre ellos | — | ⚠️ **Decisión de arquitectura que necesito que confirmes** (ver sección siguiente) |
| 7 | Móvil con las mismas capacidades exactas, no una versión limitada | La web (`channels/web/`) ya es responsive y habla el mismo protocolo que cualquier canal | Solo falta **desplegarla** (deja de ser "local" y pasa a ser accesible desde cualquier dispositivo) — no es un desarrollo nuevo, es el mismo Next.js ya construido, en producción |
| 8 | Voz como experiencia principal, femenina, natural, profesional | Voz de navegador ya implementada (gratis) pero Jorge ya la calificó de insuficiente | Subir de escalón: ADR-0002 escalón C (voz de pago tipo ElevenLabs, ~5 USD/mes) — coherente con que ahora la voz es "principal", no accesorio |
| 9 | Iniciar/continuar trabajos largos, avisar solo cuando haga falta decidir o al terminar | Mismo mecanismo que el punto 2 (trabajos asíncronos) | + Un canal de notificación (al menos en la web: polling/SSE; a futuro WhatsApp) |
| 10 | Anticiparse: detectar huecos, tareas pendientes, sugerir | Ya estaba en el roadmap original (F2: "Managed Agents scheduled deployment") | Construir ese primer trabajo programado: revisión periódica de la wiki/proyectos → sugerencias |
| 11 | Una sola identidad, sin sentir módulos separados | — | **Este es el cambio de diseño central de este ADR**: un orquestador que decide qué herramienta usar, no un menú de modos |
| 12 | Estilo "Alexa": controlar luces/dispositivos de la oficina, activarse al decir "Atlas" y responder qué puede hacer | — | ⚠️ **Requiere investigación previa que no puedo hacer sin datos de Jorge**: ¿qué hardware hay ya en la oficina? (enchufes/bombillos Wi-Fi tipo Tuya/SmartLife, Zigbee con hub, Google Home/Alexa ya instalados, Home Assistant, nada todavía). La respuesta cambia por completo el diseño y el coste. El "wake word" (activarse al decir "Atlas") es un desarrollo aparte del control de dispositivos — se puede prototipar con la Web Speech API (escucha continua filtrando la palabra "Atlas") independientemente de qué hardware se decida para las luces |

## Decisión cerrada 1 — espacios de trabajo: Opción A confirmada

Jorge confirmó (2026-07-30): **una sola instancia central**, ampliable a un tercer usuario en el futuro (equipo puede crecer más allá de él y José). Cada persona tiene su sección de datos dentro del mismo sistema — no hay instancias separadas por máquina.

## Decisión cerrada 2 — prioridad real: profundidad del cerebro, no IoT

Jorge fue explícito: el control de luces/TV estilo Alexa **queda en segundo plano** ("una que otra cosa" en la oficina, sin urgencia). Lo que sí importa, en este orden:

1. **Que el cerebro tenga conocimiento profundo y real de todos los proyectos** — no solo los resúmenes curados de `docs/wiki/proyectos/`, sino la documentación técnica real de cada repo (READMEs, `docs/`, ADRs propios de cada proyecto, `CLAUDE.md`).
2. **Administración de proyectos** (estado, tareas, decisiones — el punto 2/4 de la tabla de arriba).
3. **Resolución de dudas de ingeniería** sobre esos proyectos reales (el punto 5, con más contexto disponible gracias al punto 1).

Punto 12 (Alexa/IoT) pasa a backlog sin fecha — se retoma cuando el resto esté sólido.

## ⚠️ Decisión que necesito que confirmes: cómo funciona "el espacio de trabajo de José" (histórico, ya resuelta arriba)

Hay dos formas honestas de construir esto, con implicaciones muy distintas de coste/complejidad:

**Opción A — Instancia centralizada única (recomendada):** Atlas vive en UN solo lugar desplegado (el VPS del roadmap original). Tanto tú como José le hablan a esa misma instancia. "El espacio de José" no es su computador físico — es una sección de la wiki/proyectos que le pertenece a él (sus repos, sus notas), a la que Atlas cambia de contexto cuando se lo pides ("revisa lo de José" → busca en esa sección). Requiere que la información de José también viva sincronizada en el sistema central (su propio Drive/repos indexados igual que los tuyos).
- *Ventaja:* una sola cosa que mantener, coherente con todo lo ya construido, más barato.
- *Límite:* Atlas no puede literalmente "entrar a mirar el escritorio de José" en tiempo real — necesita que esa información esté sincronizada al sistema central primero.

**Opción B — Una instancia por persona/máquina:** José corre su propio Atlas local (como el tuyo hoy), y hay un mecanismo de enrutamiento entre ambos. Más fiel a "acceder literalmente a su computador", pero duplica infraestructura, complejiza el guardarraíl de autorización (¿quién autoriza qué en la instancia de quién?), y no encaja con el desliegue centralizado que ya planeamos para que ambos accedan a distancia.

**Mi recomendación: Opción A.** Resuelve remoto+móvil+multiusuario con una sola pieza de infraestructura, y es la que ya veníamos construyendo. La diferencia es solo qué datos indexamos (los tuyos y los de José, en secciones separadas de la misma wiki) — no requiere una segunda instancia. Necesito que confirmes esto antes de tocar el modelo de datos.

## Diseño del orquestador (el cambio central)

```
                         ┌─────────────────────────────┐
                         │   Atlas Orchestrator         │
Petición (texto/voz) ───▶│   (nuevo, dentro del gateway)│
                         │   decide qué capacidad usar  │
                         └───────────┬─────────────────┘
                                     │
              ┌──────────────┬──────┴───────┬──────────────┬───────────────┐
              ▼              ▼              ▼              ▼               ▼
         askBrain       devAgent      webSearch      scheduler       documentGen
       (RAG, solo      (código real,   (respaldo      (agenda,        (generar
        lectura, ya    escritura,      cuando RAG     trabajos        docs, F2)
        existe)        ya existe,      no alcanza,    largos —
                       reforzado)      nuevo)         nuevo)
              │              │              │              │               │
              └──────────────┴──────┬───────┴──────────────┴───────────────┘
                                     ▼
                         canUseTool — guardarraíl único
                    (acción sensible → autorización; una vez
                     dada, ejecuta todo sin más fricción)
```

Todas las capacidades comparten: el mismo `ModelRouter` (política de coste), el mismo guardarraíl de autorización, la misma persistencia (Postgres), y se exponen al usuario bajo **un solo endpoint conversacional** (`POST /atlas` o similar) — el canal (web, móvil, WhatsApp a futuro) no sabe ni le importa qué capacidad se usó por dentro.

## Orden de construcción propuesto (sin implementar nada todavía — a la espera de tu confirmación)

1. Orquestador básico (enruta entre `askBrain` y `devAgent` según la intención — sin sumar capacidades nuevas todavía, solo unificar las dos que ya existen bajo una interfaz).
2. Trabajos asíncronos (tabla `jobs`, notificación de progreso) — desbloquea "procesos largos sin supervisar".
3. Generalizar el guardarraíl de autorización a más tipos de acción sensible.
4. WebSearch como respaldo del RAG.
5. Resolver ⚠️ el modelo de espacios de trabajo (Opción A/B) → indexar los datos de José.
6. Voz de mayor calidad (ElevenLabs) — depende de presupuesto.
7. Despliegue centralizado real (VPS) — esto es lo que activa "móvil" y "a distancia" de verdad.
8. Trabajo programado de sugerencias proactivas (F2 original).

## Consecuencias

- No se descarta nada de lo ya construido — `askBrain`, `devAgent`, `Retriever`, `ModelRouter`, `Channel` siguen siendo las piezas; el orquestador las une.
- El coste sube (voz de pago, VPS de verdad, más tokens por más capacidades) — hay que revisar el presupuesto de ADR-0001 §3 en cuanto se confirme el alcance.
- Cada capacidad nueva hereda el guardarraíl de autorización por diseño — ninguna se construye "autónoma por defecto".
