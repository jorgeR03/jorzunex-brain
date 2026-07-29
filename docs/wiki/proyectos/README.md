# proyectos/ — Ficha por proyecto

Un archivo Markdown por proyecto (`<nombre-proyecto>.md`). Complementa `clientes/`: el
cliente es "quién", el proyecto es "en qué estamos trabajando y qué se decidió". Alimenta
el pilar 1 ("sabe todo") y el pilar 3 (multiplicador de entrega) de `docs/VISION.md`.

Copia esta plantilla al crear un proyecto nuevo:

```markdown
---
tipo: proyecto
actualizado: YYYY-MM-DD
estado: activo   # activo | pausado | entregado | cancelado
cliente: <nombre-cliente o "interno">
---

# <Nombre del proyecto>

## Objetivo
_(qué problema resuelve, en 1-2 frases)_

## Estado actual
_(en qué fase está, qué falta)_

## Decisiones clave
_(elecciones importantes y por qué — si son técnicas de peso, considera un ADR aparte)_

## Próximos pasos
_(lista corta, lo inmediato)_
```

5 minutos por archivo. Mejor actualizarlo poco y a menudo que dejarlo perfecto una vez y
que quede obsoleto.

## EJEMPLO / PLANTILLA A BORRAR

Ver `_ejemplo-proyecto.md` en esta misma carpeta — caso ficticio para ilustrar el formato.
Bórralo en cuanto crees el primer proyecto real.
