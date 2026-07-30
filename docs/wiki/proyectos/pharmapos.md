---
tipo: proyecto
actualizado: 2026-07-29
estado: activo
cliente: interno (SaaS propio — farmacias en LATAM)
---

# PharmaPOS (Gestión de farmacias)

## Objetivo
Plataforma SaaS enterprise para la gestión integral de farmacias en LATAM: punto
de venta, inventario con control FEFO (first-expired-first-out), catálogo de
productos, facturación electrónica DIAN, CRM/fidelización de clientes, compras a
proveedores y analítica/KPIs.

## Estado actual
En desarrollo. El repo local (`Gestion de farmacias/`) tiene arquitectura de 9
microservicios definida (pos, inventory, product, billing, crm, procurement,
auth, analytics, notification-service) en Java 21 + Spring Boot 3.2, con
documentación extensa propia (`ARCHITECTURE.md`, `PROJECT_STATUS.md`,
`PENDING_TASKS.md`, `MAINTENANCE_GUIDE.md`, `OPUS_HANDOVER.md`). El nombre
comercial **PharmaPOS** también aparece listado como uno de los 5 productos que
vende el motor de prospección interno (`docs/wiki/proyectos/agende-de-ventas.md`),
con demo en `pos-web-hazel.vercel.app`.

## Decisiones clave
- Multi-tenancy **schema-per-tenant** en PostgreSQL 16 (igual que RepartOS).
- Auth centralizada con Keycloak 23; mensajería entre servicios con Kafka 7.5;
  búsqueda con Elasticsearch 8; infraestructura pensada para Kubernetes +
  Terraform (más "enterprise" que el resto de productos JorZunex, que en general
  usan Vercel/Railway).

## Próximos pasos
No resumido en detalle en esta sesión — el propio repo tiene
`docs/roadmap/roadmap.md` ("MVP a Enterprise") y `PENDING_TASKS.md` con el
detalle actualizado; consultarlos directamente si se necesita el estado
más fino de este proyecto.
