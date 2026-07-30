---
tipo: proyecto
actualizado: 2026-07-29
estado: activo
cliente: interno
---

# JorZunexFinanzas

## Objetivo
Herramienta interna de gestión financiera para los dos socios de JorZunex
Solutions (Jorge y José): registro de ingresos, egresos, ahorro y otros
movimientos, con categorías propias (sueldo, negocio, deudas / servicios,
gastos operativos, nómina, marketing) y gráficos interactivos.

## Estado actual
Activo. App estática (HTML/CSS/JS + Chart.js + Phosphor Icons) publicada en
GitHub Pages (`jorzunex.github.io/JorZunexFinanzas/`). Sincronización entre
dispositivos opcional vía Supabase; por defecto usa `localStorage` del navegador
con exportación/importación manual en JSON.

## Decisiones clave
- Sin backend propio: todo el cálculo y almacenamiento vive en el cliente
  (localStorage) o en una tabla simple de Supabase si se configura.
- Diseño alineado a la identidad visual de JorZunex (neón cian/azul, púrpura).

## Próximos pasos
No documentado en el README. El repo contiene además una copia de la hoja de
cálculo real de gastos e ingresos de la empresa (`Copia de Gastos e Ingresos.xlsx`)
— **no se abrió su contenido en esta sesión** por tratarse de datos financieros
reales, siguiendo el mismo criterio de prudencia que se aplicó con las carpetas
"Balance de la empresa" y "Documentación legal" del Drive (fuera del alcance
explícito de esta tarea, pero con la misma sensibilidad).
