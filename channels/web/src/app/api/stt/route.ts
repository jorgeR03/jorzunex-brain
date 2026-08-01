/**
 * Proxy hacia el motor de voz→texto local del gateway (Whisper vía
 * @xenova/transformers, POST /stt, ADR-0002 Escalón B). Cuerpo: audio/wav
 * crudo — se reenvía tal cual, sin tocarlo, para no perder calidad ni
 * gastar tiempo re-codificando.
 */

const GATEWAY_URL = process.env.GATEWAY_HTTP_URL ?? "http://localhost:8787";

export async function POST(request: Request) {
  const audio = await request.arrayBuffer();
  if (audio.byteLength === 0) {
    return Response.json({ error: "Cuerpo de audio vacío." }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${GATEWAY_URL}/stt`, {
      method: "POST",
      headers: { "Content-Type": "audio/wav" },
      body: audio,
    });
    const data = await upstream.json();
    return Response.json(data, { status: upstream.status });
  } catch (error) {
    return Response.json(
      {
        error: "No se pudo contactar al gateway para STT.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}
