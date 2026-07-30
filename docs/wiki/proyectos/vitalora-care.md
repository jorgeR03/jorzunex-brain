---
tipo: proyecto
actualizado: 2026-07-29
estado: activo
cliente: interno (trabajo de grado / proyecto académico-comercial)
---

# Vitalora Care

## Objetivo
Plataforma web de acompañamiento y monitoreo predictivo con IA para pacientes
oncológicos en Colombia: gestión de medicamentos/citas/síntomas, análisis
predictivo de riesgo de deterioro clínico (score 0-100), chatbot conversacional
con **Claude AI** que responde usando el historial real del paciente (RAG), y una
comunidad de apoyo entre pacientes. Problema que ataca: solo 50% de adherencia
terapéutica en oncología (OMS) y detección tardía de deterioro.

## Estado actual
Es el **trabajo de grado de Ingeniería de Sistemas** de Jorge Andrés Carmona
Ramírez y **José Manuel Zuluaga Figueroa** (ver `docs/wiki/equipo/jose.md`),
documento maestro fechado en el Drive (`JorZunex Solutions/Proyectos/Vitalora IA/`).
Fase 1 declarada: MVP académico, totalmente gratuito y open-source, con objetivo
de 50-100 pacientes piloto para validación técnica y académica. También existe una
guía de implementación técnica extensa (`GUIA_IMPLEMENTACION_COMPLETA.md.pdf`, no
abierta en detalle por esta sesión — ver nota abajo) y una presentación de
producto (`Vitalora_Care_Presentacion.pptx`).

## Decisiones clave
- Diferenciador declarado: primera plataforma en Colombia que combina análisis
  predictivo + chatbot médico + cumplimiento de la Ley 1581 de 2012 (Habeas Data)
  específicamente para oncología.
- Modelo de negocio a futuro (fuera del MVP académico): Fase 2 freemium (plan
  gratuito básico + premium $9.99/mes con IA completa); Fase 3 enterprise
  hospitalario ($500-2.000/mes por hospital, integración HL7/FHIR).
- Mercado objetivo inicial: 10.000 pacientes en Medellín y Bogotá en los primeros
  2 años, sobre un total de 113.000 casos nuevos de cáncer/año en Colombia
  (Globocan 2020).

## Próximos pasos
Según el documento maestro: validar el MVP con el piloto de 50-100 pacientes
(Fase 1 académica) antes de plantear la transición a freemium. No hay evidencia
en las fuentes revisadas de que el proyecto tenga ya un despliegue en producción
o clientes reales — a diferencia de RepartOS/GymApp/MotoGest, este es un proyecto
en fase de validación académica.

> Nota: no se abrió el contenido completo de `GUIA_IMPLEMENTACION_COMPLETA.md.pdf`
> (1.1 MB) por límite de tiempo de esta sesión — solo se leyó el documento maestro
> (`01_Documento_Maestro_Vitalora.docx`). Si se necesita el detalle técnico
> completo (arquitectura, modelo de datos), pendiente para una sesión futura.
