---
tipo: proyecto
actualizado: 2026-07-29
estado: activo
cliente: interno (SaaS propio — talleres de motos en Colombia/LATAM)
---

# MotoGest Pro

## Objetivo
"El taller completo, en una sola pantalla": SaaS de gestión integral para talleres
de motos tipo almacén — mecánicos con comisiones automáticas, órdenes de trabajo,
inventario de repuestos, clientes/CRM, facturación electrónica DIAN, cuentas por
cobrar (fiado, plan separe) y contabilidad básica (P&L mensual).

## Estado actual
**En producción**, desplegado en Railway (`motogest-web.vercel.app` para el
frontend). El repo incluye `railway.json`/`nixpacks.toml` listos y documenta el
flujo completo de despliegue (migraciones + seed automáticos en el primer deploy).

## Decisiones clave
- Stack: Node.js 20 + Fastify + Prisma + PostgreSQL 16 (backend), React 18 +
  TypeScript + TailwindCSS + shadcn/ui (frontend).
- Reglas de negocio críticas de nómina colombiana: la comisión del mecánico se
  calcula **solo sobre mano de obra** (nunca repuestos ni lavado); si la orden es
  garantía (`esGarantia=true`) la comisión es cero; la base prestacional sigue el
  artículo 127 del CST (salario base + promedio de comisiones de los últimos 3
  meses).
- Multi-tenancy por `tallerId` en cada query (row-level isolation manual, no RLS
  de Postgres).
- 3 planes de precio: Local Único $300.000 COP/mes, Multi-sede $600.000 COP/mes
  (hasta 4 sedes), Enterprise personalizado — con 30 días de prueba gratis.

## Próximos pasos
No hay un roadmap explícito en el README (es una guía operativa de despliegue, no
un plan de producto). El proyecto ya está en producción; el siguiente paso natural
sería documentar aquí las funcionalidades pendientes cuando Jorge las priorice.
