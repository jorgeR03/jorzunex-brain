# clientes/ — Ficha por cliente

Un archivo Markdown por cliente (`<nombre-cliente>.md`). Esto alimenta el pilar 1 de
`docs/VISION.md` ("sabe todo"): el Brain necesita contexto de cliente para responder
preguntas, redactar propuestas de seguimiento y no hacerte repetir lo mismo dos veces.

Copia esta plantilla al crear un cliente nuevo:

```markdown
---
tipo: perfil-cliente
actualizado: YYYY-MM-DD
estado: activo   # activo | pausado | cerrado
---

# <Nombre del cliente>

## Contacto
- Persona(s) de contacto:
- Email / teléfono / canal preferido:

## Proyectos activos
- Ver `docs/wiki/proyectos/<proyecto>.md`

## Historial relevante
_(hitos, acuerdos importantes, cosas que dijo y que no queremos olvidar)_

## Preferencias
_(cómo le gusta que le hablen, plazos, sensibilidades, qué evitar)_
```

5 minutos y ya: no hace falta rellenar todo de golpe, mejor un archivo corto y real que uno
perfecto y vacío.

## EJEMPLO / PLANTILLA A BORRAR

Ver `_ejemplo-cliente.md` en esta misma carpeta — es un caso ficticio para ilustrar el
formato. Bórralo en cuanto crees el primer cliente real.
