---
tipo: proyecto
actualizado: 2026-07-29
estado: activo
cliente: interno
---

# Agende de Ventas

## Objetivo
Motor de prospección interno de JorZunex Solutions para conseguir clientes de sus
propios SaaS **sin ir tienda por tienda**: busca negocios reales por ciudad y
rubro (vía OpenStreetMap, gratis y sin API key), los organiza en un mini-CRM con
pipeline (nuevo → contactado → interesado → demo agendada → cliente), y genera
mensajes de WhatsApp/email personalizados listos para enviar en 2 clics.

## Estado actual
Activo y funcional en local (`node server.js`, UI en `localhost:4321`). Vende los
5 productos SaaS de la empresa, cada uno con su demo pública:

| Rubro | Producto | Demo |
|---|---|---|
| Farmacias | PharmaPOS | pos-web-hazel.vercel.app |
| Gimnasios | PowerFit (GymApp) | gym-app-web-chi.vercel.app |
| Restaurantes | RepartOS | customer-app-gold.vercel.app |
| Talleres de moto | MotoGest Pro | motogest-web.vercel.app |
| Inmobiliarias | Portal JorZunex | jorzunex.vercel.app |

**Nota importante para el Brain:** este proyecto ya cumple, de forma manual e
independiente, buena parte de lo que `docs/VISION.md` (pilar 3, "Motor comercial")
propone construir como epic nueva del Brain. Antes de construir "Motor comercial
v0" desde cero, revisar si conviene **integrarse con `Agende de Ventas` existente**
en vez de duplicarlo.

## Decisiones clave
- WhatsApp exclusivamente **manual** (click-to-chat) para no arriesgar el número:
  Meta banea números que automatizan envíos masivos desde WhatsApp normal. Límite
  autoimpuesto de ~20-30 contactos nuevos/día.
- Cumplimiento Habeas Data (Ley 1581/2012): contacto B2B a datos públicos del
  negocio, pero los mensajes generados siempre ofrecen opción de exclusión.
- Rutina de ventas documentada: 30-45 min/día, seguimientos pendientes primero,
  10-20 contactos nuevos/día, una búsqueda nueva por semana en otra ciudad/rubro.

## Próximos pasos
Según el propio README: Google Places API (mejor cobertura de teléfonos, ~90% vs
~10% de OSM, con $200 USD/mes gratis de crédito en Google Cloud), WhatsApp
Business Cloud API para automatizar de verdad el primer contacto con plantillas
aprobadas, y una página de agendamiento automática (Cal.com o similar).
