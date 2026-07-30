"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { BrainCircuit, Mic, Send, Square } from "lucide-react";
import "./speech.d.ts";
import { Orb, type AssistantState } from "./Orb";

interface ChatMessage {
  role: "user" | "brain";
  text: string;
  citations?: string[];
  model?: string;
  isError?: boolean;
}

/**
 * Elige y recuerda UNA sola voz en español, femenina, consistente (no una
 * distinta cada vez). La Web Speech API no expone el género de la voz como
 * campo — se infiere por nombres conocidos de voces femeninas en español
 * que traen Windows/Edge/Chrome (Elvira, Helena, Sabina, Lucía, Mónica,
 * Laura, Paloma, Google español que por defecto es femenina). Prioriza
 * además las voces "Online"/"Natural" (neurales, mejor calidad).
 */
const FEMALE_VOICE_NAMES = /elvira|helena|sabina|lucia|lucía|monica|mónica|laura|paloma|female|mujer/i;

function pickSpanishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const spanish = voices.filter((v) => v.lang?.toLowerCase().startsWith("es"));
  if (spanish.length === 0) return null;

  const femaleHighQuality = spanish.find(
    (v) => FEMALE_VOICE_NAMES.test(v.name) && /online|natural|neural/i.test(v.name),
  );
  const femaleAny = spanish.find((v) => FEMALE_VOICE_NAMES.test(v.name));
  const googleEs = spanish.find((v) => /google/i.test(v.name)); // "Google español" es femenina por defecto
  const highQualityAny = spanish.find((v) => /online|natural|neural/i.test(v.name));

  return femaleHighQuality ?? femaleAny ?? googleEs ?? highQualityAny ?? spanish[0];
}

/**
 * Chat con "modo conversación" continuo (Jarvis-style): al activarlo, el
 * ciclo escuchar -> preguntar -> responder con voz -> volver a escuchar se
 * repite solo, sin volver a tocar el micrófono, hasta que el usuario lo
 * detiene explícitamente. Ver docs/adr/ADR-0002-asistente-de-voz.md.
 */
export default function BrainChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [assistantState, setAssistantState] = useState<AssistantState>("idle");
  const [conversationMode, setConversationMode] = useState(false);

  const recognitionRef = useRef<InstanceType<NonNullable<Window["SpeechRecognition"]>> | null>(
    null,
  );
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  // Refs "espejo" del estado: los callbacks de SpeechRecognition/Synthesis
  // se registran una vez y necesitan leer el valor MÁS RECIENTE, no el
  // capturado en el render en que se creó el closure.
  const conversationModeRef = useRef(false);
  const assistantStateRef = useRef<AssistantState>("idle");

  useEffect(() => {
    conversationModeRef.current = conversationMode;
  }, [conversationMode]);
  useEffect(() => {
    assistantStateRef.current = assistantState;
  }, [assistantState]);

  // Carga la voz en español una sola vez (getVoices() puede llegar vacío al
  // principio; hay que esperar el evento 'voiceschanged' en varios navegadores).
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    function loadVoice() {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) voiceRef.current = pickSpanishVoice(voices);
    }
    loadVoice();
    window.speechSynthesis.onvoiceschanged = loadVoice;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  function startListening() {
    if (typeof window === "undefined") return;
    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      alert("Este navegador no soporta reconocimiento de voz. Prueba con Chrome o Edge.");
      setConversationMode(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "es-ES";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      setInput("");
      void sendQuestion(transcript);
    };
    recognition.onerror = () => {
      // "no-speech" (silencio) es normal en modo conversación: se reintenta
      // en onend. Otros errores (permiso denegado, etc.) cortan el modo.
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      // Solo se relanza si sigue en modo conversación y no está a mitad de
      // preguntar/responder (evita que el micro se oiga a sí mismo hablando).
      if (conversationModeRef.current && assistantStateRef.current !== "speaking" && assistantStateRef.current !== "thinking") {
        setAssistantState("listening");
        setTimeout(() => startListening(), 300);
      } else if (!conversationModeRef.current) {
        setAssistantState((s) => (s === "listening" ? "idle" : s));
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setAssistantState("listening");
  }

  function stopConversation() {
    setConversationMode(false);
    conversationModeRef.current = false;
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
    setAssistantState("idle");
  }

  function toggleConversation() {
    if (conversationMode) {
      stopConversation();
    } else {
      setConversationMode(true);
      conversationModeRef.current = true;
      startListening();
    }
  }

  function speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    if (voiceRef.current) utterance.voice = voiceRef.current;
    utterance.onstart = () => setAssistantState("speaking");
    utterance.onend = () => {
      // Al terminar de hablar, si sigue en modo conversación, vuelve a
      // escuchar sola — el ciclo completo tipo Jarvis, sin tocar nada.
      if (conversationModeRef.current) {
        setTimeout(() => startListening(), 250);
      } else {
        setAssistantState("idle");
      }
    };
    utterance.onerror = () => setAssistantState("idle");
    window.speechSynthesis.speak(utterance);
  }

  async function sendQuestion(question: string) {
    if (!question.trim()) return;
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setAssistantState("thinking");

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, outputMode: "voice" }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "brain", text: data.error ?? "Error desconocido.", isError: true },
        ]);
        setAssistantState(conversationModeRef.current ? "listening" : "idle");
        if (conversationModeRef.current) setTimeout(() => startListening(), 250);
        return;
      }

      const answer: string = data.answer ?? "(sin respuesta)";
      setMessages((prev) => [
        ...prev,
        { role: "brain", text: answer, citations: data.citations, model: data.model },
      ]);
      speak(answer);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "brain",
          text: `No se pudo conectar con el Brain: ${error instanceof Error ? error.message : String(error)}`,
          isError: true,
        },
      ]);
      setAssistantState("idle");
    }
  }

  const thinking = assistantState === "thinking";

  return (
    <main
      className="mx-auto flex h-screen w-full max-w-2xl flex-col p-4"
      style={{ background: "var(--background)" }}
    >
      <header
        className="mb-1 flex items-center justify-between border-b pb-3"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2.5">
          <Image
            src="/jorzunex-logo.png"
            alt="JorZunex"
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg object-cover"
            style={{ boxShadow: "0 0 16px 2px rgba(0,200,255,.25)" }}
          />
          <div className="flex flex-col leading-tight">
            <h1
              className="text-lg font-bold tracking-tight"
              style={{
                backgroundImage: "var(--grad)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              JorZunex Brain
            </h1>
            <span className="text-[11px]" style={{ color: "var(--text-dim)" }}>
              Atlas · asistente interno
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleConversation}
          className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition"
          style={{
            background: conversationMode ? "var(--neon)" : "var(--card)",
            color: conversationMode ? "#04060a" : "var(--text-dim)",
            border: "1px solid var(--border-hi)",
          }}
        >
          {conversationMode ? <Square size={14} /> : <Mic size={14} />}
          {conversationMode ? "Terminar conversación" : "Modo conversación"}
        </button>
      </header>

      <div className="mb-2 flex flex-col items-center gap-3 pt-2">
        <Orb state={assistantState} />
        <span className="jorzunex-badge">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--neon)", boxShadow: "0 0 6px 1px var(--neon)" }}
          />
          JorZunex Solutions · Innovación · IA
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pt-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-3 pt-6 text-center">
            <Image
              src="/jorzunex-logo.png"
              alt=""
              width={64}
              height={64}
              className="h-16 w-16 rounded-2xl opacity-20"
            />
            <p className="max-w-xs text-sm" style={{ color: "var(--text-dim)" }}>
              Activa &ldquo;Modo conversación&rdquo; y habla — Atlas te responde con voz y
              vuelve a escuchar solo. También puedes escribir abajo.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className="rounded-xl px-4 py-3 text-sm shadow-lg"
            style={
              m.role === "user"
                ? {
                    marginLeft: "2.5rem",
                    background: "var(--card)",
                    border: "1px solid var(--border-hi)",
                    boxShadow: "0 4px 20px -8px rgba(0,200,255,.15)",
                  }
                : m.isError
                  ? {
                      marginRight: "2.5rem",
                      background: "rgba(120,10,10,.25)",
                      border: "1px solid rgba(255,80,80,.3)",
                      color: "#ffb4b4",
                    }
                  : {
                      marginRight: "2.5rem",
                      background: "var(--bg3)",
                      borderLeft: "2.5px solid var(--neon)",
                      border: "1px solid var(--border)",
                      borderLeftWidth: "2.5px",
                      boxShadow: "0 4px 24px -10px rgba(0,200,255,.2)",
                    }
            }
          >
            <p className="whitespace-pre-wrap leading-relaxed" style={{ color: "var(--foreground)" }}>
              {m.text}
            </p>
            {m.citations && m.citations.length > 0 && (
              <p
                className="mt-2.5 border-t pt-2 text-xs"
                style={{ color: "var(--text-dim)", borderColor: "var(--border)" }}
              >
                Fuentes: {m.citations.slice(0, 5).join(", ")}
                {m.model ? ` · ${m.model}` : ""}
              </p>
            )}
          </div>
        ))}
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void sendQuestion(input);
        }}
      >
        <div
          className="flex items-center justify-center rounded-full px-3"
          style={{ color: "var(--text-dim)" }}
          title="El Brain (BrainCircuit)"
        >
          <BrainCircuit size={18} />
        </div>
        <input
          className="flex-1 rounded-lg border px-3 py-2 text-sm"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
            color: "var(--foreground)",
          }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu pregunta…"
          disabled={thinking}
        />
        <button
          type="submit"
          className="flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ backgroundImage: "var(--grad)", color: "#04060a" }}
          disabled={thinking || !input.trim()}
        >
          <Send size={16} />
        </button>
      </form>
    </main>
  );
}
