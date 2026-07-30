/**
 * Proxy hacia el TTS de alta calidad del gateway (ElevenLabs, ADR-0002
 * escalón C). Si el gateway responde 501 (no configurado) o cualquier
 * error, el frontend debe capturar eso y usar speechSynthesis del
 * navegador como respaldo — nunca romper la conversación por esto.
 */
const GATEWAY_URL = process.env.GATEWAY_HTTP_URL ?? "http://localhost:8787";

export async function POST(request: Request) {
  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  if (!body.text || !body.text.trim()) {
    return Response.json({ error: "El campo 'text' es obligatorio." }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${GATEWAY_URL}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: body.text }),
    });

    if (!upstream.ok) {
      const data = await upstream.json().catch(() => ({}));
      return Response.json(data, { status: upstream.status });
    }

    const audio = await upstream.arrayBuffer();
    return new Response(audio, { headers: { "Content-Type": "audio/mpeg" } });
  } catch (error) {
    return Response.json(
      { error: "No se pudo contactar al gateway para TTS.", fallback: "browser", detail: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}
