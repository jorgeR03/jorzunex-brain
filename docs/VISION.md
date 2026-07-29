# VISIÓN — JorZunex Brain ("Jarvis de JorZunex")

> Palabras de Jorge (2026-07-29): *"quiero algo tipo Jarvis pero que sepa todo de mí y de mi equipo, de la empresa, que pueda hacer plata solo"*.
> Este documento traduce esa visión a objetivos ejecutables. Todo modelo que trabaje aquí debe alinear sus tareas con estos 3 pilares.

## Pilar 1 — Sabe todo (memoria total)

El Brain conoce a Jorge, al equipo y a la empresa mejor que cualquier documento suelto:
- **Perfil por persona** (`docs/wiki/equipo/<nombre>.md` + memoria de agente): rol, preferencias, proyectos, contexto actual.
- **Empresa**: clientes, proyectos, finanzas, decisiones (ADRs), procesos — en `docs/wiki/` + RAG (pgvector) + grafo temporal (Graphiti, F3).
- Regla: **todo lo que el Brain aprende se escribe** (wiki o memoria). Una conversación que no deja rastro es conocimiento perdido.

## Pilar 2 — Se comporta como Jarvis (proactivo + voz)

No espera órdenes: propone, avisa y ejecuta rutinas.
- **Voz**: ADR-0002 (navegador gratis → Whisper/Piper self-host → premium).
- **Proactividad** (F2+): briefing diario por canal preferido (agenda, pendientes, novedades de clientes/GitHub), alertas de cosas que requieren decisión, seguimiento de compromisos ("dijiste que X para el viernes").
- **Multi-canal**: CLI/web/Slack/WhatsApp — misma memoria en todos.

## Pilar 3 — Genera ingresos (con honestidad sobre lo posible)

Un agente no "imprime plata" solo: **multiplica la capacidad de generar ingresos con las actividades del negocio**. Módulos de ingresos, en orden de retorno esperado:

1. **Motor comercial** (el de mayor ROI): prospección (investigar leads, enriquecer contactos), redacción de propuestas/presupuestos personalizados con el conocimiento de la empresa, seguimiento automático de clientes y facturas pendientes.
2. **Multiplicador de entrega**: acelerar los proyectos que ya facturan (código, docs, informes) → más margen por proyecto.
3. **Contenido/marketing**: publicaciones, portfolio, SEO — pipeline semiautomático con revisión humana.
4. **Productización futura**: si los módulos 1–3 funcionan para JorZunex, se pueden vender como servicio a clientes (ojo licencia n8n → ADR previo).

**Salvaguarda vinculante:** ningún agente envía comunicaciones a clientes, gasta dinero o firma compromisos sin aprobación humana, hasta que las evals demuestren fiabilidad módulo a módulo (riesgo R4/R11 del estudio). "Hacer plata solo" se conquista por etapas: primero borrador+aprobación, luego autonomía por tipo de acción.

## Métricas de éxito (revisar mensualmente)

| Pilar | Métrica |
|---|---|
| Memoria | % preguntas sobre la empresa respondidas correctamente (suite de oro) |
| Jarvis | Interacciones/semana del equipo; nº rutinas proactivas activas |
| Ingresos | Horas/semana ahorradas; propuestas generadas; € atribuibles a leads/seguimientos del Brain |

## Traducción a backlog

Los módulos de ingresos entran como epic nueva tras la PoC-2: **"Motor comercial v0"** = agente que investiga un lead y redacta borrador de propuesta usando la wiki (revisión humana). Prioridad: justo después de F1, antes que WhatsApp.
