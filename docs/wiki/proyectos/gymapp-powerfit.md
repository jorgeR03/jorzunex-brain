---
tipo: proyecto
actualizado: 2026-07-29
estado: activo
cliente: interno (SaaS propio — gimnasios colombianos)
---

# GymApp — PowerFit

## Objetivo
Plataforma SaaS multi-tenant para gestión integral de gimnasios: membresías con
alertas de vencimiento, clases grupales con cupos y lista de espera, chat directo
miembro-entrenador, rutinas de entrenamiento y nutrición, comunidad tipo red social
interna, pagos PSE (Colombia) y chatbot IA para dudas sobre ejercicios.

## Estado actual
Nombre comercial: **PowerFit**. La presentación corporativa "Claude Code — JorZunex
Solutions" (mayo 2026) y el CV de Jorge lo listan como **en producción**
(`gymapp-col.vercel.app` / `gym-app-web-chi.vercel.app`). El repositorio local
(`C:\Users\jorge\ProyectosJorZunex\GymApp`) muestra el roadmap técnico más granular:
Sprint 1 de la Fase 1 (Base — auth multi-tenant, roles, esquema DB con RLS)
completado; Sprints 2-5 (membresías, clases, chat+entrenadores, pagos+comunidad)
documentados pero no confirmados como terminados en el README.

Existe documentación técnica extensa en el Drive
(`JorZunex Solutions/Proyectos/GymAPP/Documentación/`): un documento de arquitectura
completo (`GymApp_Documentacion_Tecnica.docx`, v1.0 2025) y un documento de
artefactos de descubrimiento (`AppGym_Artefactos_Proyecto.docx`) con mapa de
impacto, modelo de dominio y requerimientos funcionales — este último describe una
versión algo distinta del stack (Astro/Python en vez de Next.js/NestJS), lo que
sugiere que el stack evolucionó entre el descubrimiento inicial y la arquitectura
final.

## Decisiones clave
- **Stack:** Next.js 14 (frontend) + Node.js/NestJS (backend) + PostgreSQL vía
  Supabase con Row Level Security para aislar cada gimnasio (`gym_id`).
- Tiempo real (chat, notificaciones) vía Supabase Realtime; cache/rate-limiting con
  Redis (Upstash); IA con OpenAI GPT-4o mini; notificaciones push con Firebase FCM;
  pagos PSE vía Wompi (elegido sobre PayU por SDK, sandbox y aprobación más rápida).
- Costo de infraestructura inicial estimado en el documento de arquitectura:
  ~$25-50 USD/mes para 200-500 usuarios activos.
- Multi-tenancy: shared database + RLS (no schema-per-tenant, a diferencia de
  RepartOS).

## Próximos pasos
Según el roadmap del documento de arquitectura (Fase 1, 10 semanas):
- Sprint 2: módulo de membresías y alertas de vencimiento.
- Sprint 3: clases grupales, cupos e inscripción en tiempo real.
- Sprint 4: chat en tiempo real y directorio de entrenadores.
- Sprint 5: integración Wompi PSE y feed de comunidad.
- Fase 2: rutinas/nutrición, chatbot IA, PWA offline, analytics.

Recomendado confirmar con Jorge en qué sprint real está el despliegue de producción
vigente (`gymapp-col.vercel.app`), ya que el README interno parece ir por detrás de
lo que ya está desplegado y presentado a clientes.
