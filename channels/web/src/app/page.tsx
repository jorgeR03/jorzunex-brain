"use client";

import { useRef, useState } from "react";
import "./speech.d.ts";

interface ChatMessage {
  role: "user" | "brain";
  text: string;
  citations?: string[];
  model?: string;
  isError?: boolean;
}

/**
 * Chat mínimo del Brain (channels/web) — habla con el gateway vía
 * /api/ask (proxy) y añade voz de navegador (escalón A de
 * docs/adr/ADR-0002-asistente-de-voz.md): micrófono con la Web Speech API
 * (gratis, Chrome/Edge) y lectura de la respuesta con speechSynthesis
 * (gratis, cualquier navegador moderno). Sin autenticación todavía — ver
 * README de este canal antes de desplegar fuera de localhost.
 */
export default function BrainChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<InstanceType<NonNullable<Window["SpeechRecognition"]>> | null>(
    null,
  );

  async function sendQuestion(question: string) {
    if (!question.trim() || loading) return;
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, outputMode: voiceMode ? "voice" : "text" }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "brain", text: data.error ?? "Error desconocido.", isError: true },
        ]);
        return;
      }

      const answer: string = data.answer ?? "(sin respuesta)";
      setMessages((prev) => [
        ...prev,
        { role: "brain", text: answer, citations: data.citations, model: data.model },
      ]);

      if (voiceMode && typeof window !== "undefined" && "speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(answer);
        utterance.lang = "es-ES";
        window.speechSynthesis.speak(utterance);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "brain",
          text: `No se pudo conectar con el Brain: ${error instanceof Error ? error.message : String(error)}`,
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function toggleListening() {
    if (typeof window === "undefined") return;
    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      alert("Este navegador no soporta reconocimiento de voz. Prueba con Chrome o Edge.");
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "es-ES";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      setInput(transcript);
      void sendQuestion(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  return (
    <main className="mx-auto flex h-screen w-full max-w-2xl flex-col p-4">
      <header className="mb-4 flex items-center justify-between border-b pb-3">
        <h1 className="text-lg font-semibold">JorZunex Brain</h1>
        <label className="flex items-center gap-2 text-sm text-neutral-500">
          <input
            type="checkbox"
            checked={voiceMode}
            onChange={(e) => setVoiceMode(e.target.checked)}
          />
          Modo voz
        </label>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-sm text-neutral-400">
            Pregúntale al Brain algo sobre la empresa, el equipo o los proyectos.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-lg px-3 py-2 text-sm ${
              m.role === "user"
                ? "ml-8 bg-neutral-800 text-white"
                : m.isError
                  ? "mr-8 bg-red-950 text-red-200"
                  : "mr-8 bg-neutral-100 text-neutral-900"
            }`}
          >
            <p className="whitespace-pre-wrap">{m.text}</p>
            {m.citations && m.citations.length > 0 && (
              <p className="mt-2 text-xs text-neutral-500">
                Fuentes: {m.citations.slice(0, 5).join(", ")}
                {m.model ? ` · ${m.model}` : ""}
              </p>
            )}
          </div>
        ))}
        {loading && <p className="mr-8 text-sm text-neutral-400">Pensando…</p>}
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void sendQuestion(input);
        }}
      >
        <button
          type="button"
          onClick={toggleListening}
          className={`rounded-full px-3 py-2 text-sm ${
            listening ? "bg-red-600 text-white" : "bg-neutral-200 text-neutral-700"
          }`}
          title="Hablar (Web Speech API)"
        >
          🎤
        </button>
        <input
          className="flex-1 rounded-lg border px-3 py-2 text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu pregunta…"
          disabled={loading}
        />
        <button
          type="submit"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          disabled={loading || !input.trim()}
        >
          Enviar
        </button>
      </form>
    </main>
  );
}
