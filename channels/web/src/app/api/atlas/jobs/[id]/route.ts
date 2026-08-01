/**
 * Proxy hacia el estado de una tarea de desarrollo en segundo plano
 * (gateway/src/devJobs.ts, vía GET /atlas/jobs/:id). El chat hace polling
 * aquí tras recibir `status: "running"` de POST /api/atlas.
 */

const GATEWAY_URL = process.env.GATEWAY_HTTP_URL ?? "http://localhost:8787";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const upstream = await fetch(`${GATEWAY_URL}/atlas/jobs/${id}`);
    const data = await upstream.json();
    return Response.json(data, { status: upstream.status });
  } catch (error) {
    return Response.json(
      {
        error: "No se pudo contactar al gateway. ¿Está corriendo 'npm run server' en gateway/?",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}
