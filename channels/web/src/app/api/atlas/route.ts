/**
 * Proxy hacia el endpoint unificado del gateway (POST /atlas, ver
 * gateway/src/orchestrator.ts). A diferencia de /api/ask (que siempre
 * llama a askBrain de solo lectura), este endpoint deja que Atlas decida
 * internamente si la petición es una pregunta o una tarea de desarrollo
 * real sobre un proyecto — el canal no necesita saberlo.
 */

const GATEWAY_URL = process.env.GATEWAY_HTTP_URL ?? "http://localhost:8787";

export async function POST(request: Request) {
  let body: {
    question?: string;
    outputMode?: "voice" | "text";
    sessionId?: string;
    asrAlternatives?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  if (!body.question || !body.question.trim()) {
    return Response.json({ error: "El campo 'question' es obligatorio." }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${GATEWAY_URL}/atlas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: body.question,
        channel: "web",
        outputMode: body.outputMode ?? "text",
        task: "default",
        sessionId: body.sessionId,
        asrAlternatives: body.asrAlternatives,
      }),
    });

    const data = await upstream.json();
    return Response.json(data, { status: upstream.status });
  } catch (error) {
    return Response.json(
      {
        error:
          "No se pudo contactar al gateway. ¿Está corriendo 'npm run server' en gateway/?",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}
