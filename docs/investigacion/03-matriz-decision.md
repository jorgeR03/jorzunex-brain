# Fase 3 — Matriz de decisión

## Criterios y pesos

| Criterio | Peso | Justificación |
|---|---|---|
| Integración con stack Claude/MCP | 25% | Es la condición para que el Brain "vea" la herramienta |
| Madurez / riesgo | 20% | Empresa real, no laboratorio |
| Coste total (licencia + operación) | 20% | Equipo pequeño, presupuesto contenido |
| Reemplazabilidad (anti lock-in) | 15% | Requisito explícito: arquitectura modular a 10 años |
| Velocidad de puesta en marcha | 10% | Valor en semanas, no trimestres |
| Escalabilidad | 10% | Debe aguantar 3-5 años de crecimiento |

Puntuación 1–5 por criterio. Umbral de adopción: ≥3,8 ponderado o ser la única opción viable de su categoría.

## Matriz (componentes críticos, ganador vs 2 alternativas mínimo)

### Orquestación de agentes
| | MCP/Claude | Madurez | Coste | Reemplazo | Velocidad | Escala | **Total** |
|---|---|---|---|---|---|---|---|
| **Claude Agent SDK** | 5 | 4 | 5 | 3 | 5 | 4 | **4,40** |
| LangGraph | 3 | 4 | 4 | 5 | 2 | 4 | 3,55 |
| CrewAI | 2 | 3 | 4 | 3 | 4 | 3 | 2,95 |
| Managed Agents (solo) | 5 | 3 (beta) | 3 | 2 | 5 | 4 | 3,70 → uso parcial (cron/batch) |

### Memoria organizacional
| | MCP/Claude | Madurez | Coste | Reemplazo | Velocidad | Escala | **Total** |
|---|---|---|---|---|---|---|---|
| Nativo (memory tool + pgvector) | 5 | 4 | 5 | 4 | 5 | 3 | **4,40** (Fase 1) |
| **Graphiti** (self-host) | 4 | 3 | 4 | 4 | 3 | 4 | **3,65** (Fase 2) |
| Mem0 | 3 | 3 | 4 | 4 | 5 | 3 | 3,45 |
| Zep cloud | 4 | 4 | 2 | 2 | 5 | 4 | 3,45 |

### Wiki / conocimiento
| | MCP/Claude | Madurez | Coste | Reemplazo | Velocidad | Escala | **Total** |
|---|---|---|---|---|---|---|---|
| **Outline** | 4 | 4 | 5 | 5 (Markdown export) | 4 | 4 | **4,35** |
| Notion | 5 | 5 | 3 | 2 | 5 | 5 | 4,05 |
| BookStack | 4 | 4 | 5 | 4 | 4 | 3 | 4,05 |

*Outline vs Notion es la decisión más ajustada del estudio → se eleva al usuario (ver 00-RESUMEN).* 

### Base vectorial / RAG
| | MCP/Claude | Madurez | Coste | Reemplazo | Velocidad | Escala | **Total** |
|---|---|---|---|---|---|---|---|
| **pgvector (en Postgres)** | 5 | 5 | 5 | 4 | 5 | 3 | **4,55** |
| Qdrant | 4 | 5 | 4 | 4 | 3 | 5 | 4,15 (plan de escala) |
| Weaviate | 3 | 4 | 3 | 3 | 3 | 5 | 3,45 |
| Pinecone | 3 | 5 | 2 | 1 | 4 | 5 | 3,25 |

### Automatización
| | MCP/Claude | Madurez | Coste | Reemplazo | Velocidad | Escala | **Total** |
|---|---|---|---|---|---|---|---|
| **n8n** | 4 | 5 | 5 | 4 | 5 | 4 | **4,50** |
| Windmill | 3 | 4 | 4 | 4 | 3 | 4 | 3,55 |
| Temporal | 2 | 5 | 3 | 4 | 1 | 5 | 3,15 |
| Zapier/Make | 3 | 5 | 2 | 2 | 5 | 3 | 3,20 |

### Observabilidad LLM
| | MCP/Claude | Madurez | Coste | Reemplazo | Velocidad | Escala | **Total** |
|---|---|---|---|---|---|---|---|
| **Langfuse self-host** | 4 | 4 | 5 | 5 (OTel) | 4 | 4 | **4,35** |
| Helicone | 3 | 4 | 4 | 4 | 5 | 3 | 3,75 |
| Phoenix | 3 | 4 | 5 | 5 | 3 | 3 | 3,80 (complemento evals) |
| LangSmith | 2 | 5 | 3 | 2 | 4 | 4 | 3,15 |

### Infraestructura
| | MCP/Claude | Madurez | Coste | Reemplazo | Velocidad | Escala | **Total** |
|---|---|---|---|---|---|---|---|
| **VPS + Coolify (+Vercel front)** | 4 | 4 | 5 | 5 | 4 | 3 | **4,25** |
| Railway/Fly.io | 4 | 4 | 3 | 4 | 5 | 4 | 3,95 |
| Kubernetes (managed) | 4 | 5 | 2 | 4 | 1 | 5 | 3,30 |

## Reglas de decisión build vs buy aplicadas

1. **Comprar/adoptar** si existe herramienta con API+MCP, madura, y el problema no es diferencial para JorZunex (auth, wiki, colas, observabilidad…).
2. **Construir** solo si: (a) no existe (puente WhatsApp↔agentes), (b) es la ventaja competitiva (prompts, skills, políticas, conocimiento del negocio), o (c) es pegamento fino (<500 líneas) que evita lock-in (interfaz de retrieval, selector de modelo).
3. **Aplazar** cualquier componente cuya necesidad no esté demostrada con uso real (Qdrant, Graphiti, Temporal, Keycloak, Redis, Elastic, K8s). El coste de añadirlos después es bajo *porque la arquitectura los aísla tras interfaces*.
