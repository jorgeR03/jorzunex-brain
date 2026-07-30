/**
 * Proxy hacia el servidor HTTP del gateway (gateway/src/server.ts).
 * Mantiene la lógica del Brain (ModelRouter, RAG, persistencia, Langfuse)
 * fuera de esta app — la web solo habla HTTP con el gateway, igual que
 * hará cualquier otro canal futuro (Slack, WhatsApp).
 */

const GATEWAY_URL = process.env.GATEWAY_HTTP_URL ?? "http://localhost:8787";

export async function POST(request: Request) {
  let body: { question?: string; outputMode?: "voice" | "text" };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  if (!body.question || !body.question.trim()) {
    return Response.json({ error: "El campo 'question' es obligatorio." }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${GATEWAY_URL}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: body.question,
        channel: "web",
        outputMode: body.outputMode ?? "text",
        task: "default",
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
