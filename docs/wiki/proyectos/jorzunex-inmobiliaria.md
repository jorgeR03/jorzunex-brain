---
tipo: proyecto
actualizado: 2026-07-29
estado: activo
cliente: interno (SaaS propio — agencias inmobiliarias)
---

# JorZunex Inmobiliaria

## Objetivo
Plataforma inmobiliaria enterprise con tours 3D, firma electrónica, facturación
electrónica y chatbot IA para atención a clientes.

## Estado actual
En desarrollo activo (`CHANGELOG.md` del repo local con actividad hasta el
28 de julio de 2026). Arquitectura Clean/Hexagonal + modular monolith pensado
para evolucionar a microservicios, con CQRS y comunicación event-driven entre
módulos.

**Posible relación con "EVO Digital":** el CV de Jorge y su GitHub (repo fijado
`Evo-Digital`, "EVO Digital PropTech Platform") mencionan un proyecto inmobiliario
anterior en **Spring Boot 3 + React 18 + arquitectura hexagonal**, distinto del
stack actual de este repo (Next.js 15 + NestJS + Prisma). No se pudo confirmar
documentalmente si `JorZunex Inmobiliaria` es la evolución/repivote de EVO
Digital o un proyecto separado — recomendado preguntarle a Jorge para no mezclar
ambos en la wiki si en realidad son distintos.

## Decisiones clave
- Stack: Next.js 15 + React 19 (frontend, con Three.js/React Three Fiber para los
  tours 3D) + NestJS 10 (backend) + PostgreSQL 16 vía Prisma + Redis/BullMQ +
  Meilisearch (búsqueda) + MinIO/S3 (storage) + OpenAI GPT-4o (chatbot).
  Autenticación JWT + Passport.js con RBAC (Super Admin, Admin, Agent, Client,
  Viewer).
- Design system propio "Liquid Glass" (violeta #6C63FF, cian #00D2FF, coral
  #FF6B9D sobre fondo azul oscuro #0A0E27).
- Seguridad: Helmet, CORS estricto, rate limiting, CSRF, XSS/CSP, bcrypt (12
  rounds), auditoría de acciones de administrador.

## Próximos pasos
No se documenta un roadmap explícito en el README más allá del setup técnico.
Pendiente aclarar con Jorge el estado comercial (¿tiene ya cliente piloto?) y la
relación con EVO Digital mencionada arriba.
