---
tipo: proyecto
actualizado: 2026-07-29
estado: activo
cliente: interno (SaaS propio — restaurantes y comercios colombianos)
---

# RepartOS

## Objetivo
Plataforma SaaS multi-tenant para restaurantes y comercios gastronómicos: menú
digital por QR de mesa, pedidos en tiempo real, pantalla de cocina (KDS), chatbot
IA por WhatsApp que toma pedidos automáticamente, pagos online (Wompi), app de
repartidores con GPS y portal de vendedores independientes con comisiones.

## Estado actual
**En producción** (`customer-app-gold.vercel.app` en el frontend web; mencionado
también como `repartos-app.vercel.app` en la presentación corporativa). Arquitectura
de microservicios en Java 21 + Spring Boot 3.3 con 5 servicios funcionando
(tenant, menu, order, notification, chatbot-service), frontend Next.js 14, app
móvil de repartidores en Expo/React Native con tracking GPS cada 30s. 15
migraciones SQL aplicadas (001–015), la última (marzo 2026) añadió plan
Enterprise multi-sede con cambio de sesión entre sucursales.

Pendiente según el propio roadmap del repo: dominio propio (hoy en subdominio
Vercel), activar WhatsApp Business API con token real, activar Wompi en
producción (llaves de prueba por ahora), Google OAuth2, publicación en Google
Play Store (falta cuenta de developer, $25 USD), módulo de reservas de mesa.

## Decisiones clave
- Multi-tenancy **schema-per-tenant** en PostgreSQL (un schema por restaurante),
  a diferencia del enfoque RLS de GymApp.
- Arquitectura hexagonal (DDD, Ports & Adapters) estricta en cada microservicio.
- Chatbot IA con **Groq (llama-3.3-70b)** como opción económica, con OpenAI GPT-4o
  como alternativa.
- 4 planes de precio mensual fijo (sin comisión por pedido): Comercio $80.000 COP
  (sin servicio de mesa, para farmacias/tiendas), Básico $120.000, Pro $200.000,
  Enterprise $500.000.
- Producción pensada para VPS genérico (Hetzner, Hostinger, DigitalOcean) vía
  `docker-compose.prod.yml`, no atado a un proveedor único.

## Próximos pasos
- Dominio personalizado propio.
- Activar WhatsApp Business API y Wompi en modo producción real.
- Publicar app de repartidores en Google Play Store.
- Módulo de reservas de mesa e integración PayU/Mercado Pago como alternativa a Wompi.
