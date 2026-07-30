---
tipo: proyecto
actualizado: 2026-07-29
estado: activo
cliente: interno (SaaS propio — empresas de mudanzas en España/México/Colombia)
---

# Zentrax

## Objetivo
Plataforma SaaS de gestión para empresas de mudanzas del mercado hispanohablante:
cotizaciones, asignación de equipos, tracking GPS en tiempo real (tipo Rappi),
facturación local (España SII/Verifactu, México CFDI 4.0, Colombia DIAN),
comunicación por WhatsApp Business API y white-labeling completo (marca del
cliente, no de JorZunex). Target: empresas de 2 a 15 camiones que hoy operan con
WhatsApp + Excel.

## Estado actual
En desarrollo. Completado: documentación y diagramas, backend API (auth, jobs,
companies), las 4 capas de Clean Architecture (.NET), Swagger + JWT en dev,
migraciones EF Core + LocalDB. Pendiente: paneles Blazor Server
(`Zentrax.Web`/`Zentrax.Admin`), SignalR `TrackingHub` para el GPS, landing page
en Next.js, y la app de campo en .NET MAUI.

## Decisiones clave
- Único producto JorZunex en **stack .NET** (ASP.NET Core 10 + Blazor Server +
  Blazor WebAssembly + .NET MAUI), en vez del Java/Node habitual del resto de
  productos — decisión explícita de arquitectura, no una migración a medias.
- 3 bases de datos separadas por responsabilidad: `ZentraxDB` (transaccional),
  `ZentraxReportsDB` (reportes, solo lectura), `ZentraxLogsDB` (auditoría
  inmutable, append-only).
- Precio fijo con **usuarios ilimitados** (diferenciador explícito frente a
  cobrar por asiento): Starter €49/mes (hasta 3 camiones), Pro €99/mes (hasta 8),
  Business €179/mes (hasta 15), Enterprise personalizado.
- Design system propio: verde lima #00DD00 sobre fondo casi negro #080C08,
  "dark-first, energético, no genérico"; solo iconos SVG (Flaticon), sin emojis
  en frontend.

## Próximos pasos
Completar `Zentrax.Web`/`Zentrax.Admin` (Blazor Server), implementar
`TrackingHub` de SignalR para el GPS en tiempo real, construir la landing page
en Next.js y la app de campo en .NET MAUI para operarios.
