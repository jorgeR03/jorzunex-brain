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
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const bargeInRef = useRef<InstanceType<NonNullable<Window["SpeechRecognition"]>> | null>(null);
  // Limpieza (parar micro/AudioContext) del turno de escucha con Whisper en
  // curso, si lo hay — necesario para poder cortarlo desde stopConversation().
  const whisperCleanupRef = useRef<(() => void) | null>(null);
  // ID de sesión del Claude Agent SDK: se guarda tras la primera respuesta y
  // se reenvía en cada pregunta siguiente para que Atlas recuerde lo hablado
  // antes en este mismo chat (sin esto, cada pregunta era una conversación
  // nueva y aislada).
  const sessionIdRef = useRef<string | undefined>(undefined);
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

  /**
   * Punto de entrada para empezar un turno de escucha: intenta primero el
   * motor principal (Whisper local, gateway/src/stt/) grabando audio real
   * con detección de silencio (VAD); si falla por lo que sea (sin permiso
   * de micrófono, gateway caído, etc.) cae automáticamente al respaldo de
   * navegador (`startListening()`, Web Speech API) para ESE turno, sin
   * romper el modo conversación. ADR-0002 Escalón B.
   */
  async function beginListeningTurn() {
    try {
      await startListeningWhisper();
    } catch {
      startListening();
    }
  }

  function stopWhisperListener() {
    whisperCleanupRef.current?.();
    whisperCleanupRef.current = null;
  }

  // Umbral de energía (RMS) para considerar que el usuario empezó a hablar.
  const WHISPER_VAD_START_RMS = 0.02;
  // Silencio sostenido tras el que se da por terminado el turno y se manda a transcribir.
  const WHISPER_VAD_SILENCE_MS = 1200;
  // Tope duro de seguridad por si el VAD nunca detecta silencio.
  const WHISPER_MAX_RECORDING_MS = 20000;
  // Grabaciones más cortas que esto se descartan como ruido/blip, no habla real.
  const WHISPER_MIN_RECORDING_MS = 300;

  function concatFloat32(chunks: Float32Array[]): Float32Array {
    const total = chunks.reduce((sum, c) => sum + c.length, 0);
    const result = new Float32Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }

  /** Re-muestrea a 16kHz (lo que espera Whisper) — interpolación lineal simple, de sobra para voz. */
  function resampleTo16k(input: Float32Array, sourceRate: number): Float32Array {
    if (sourceRate === 16000) return input;
    const ratio = sourceRate / 16000;
    const newLength = Math.round(input.length / ratio);
    const output = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * ratio;
      const i0 = Math.floor(srcIndex);
      const i1 = Math.min(i0 + 1, input.length - 1);
      const frac = srcIndex - i0;
      output[i] = input[i0] * (1 - frac) + input[i1] * frac;
    }
    return output;
  }

  /** Codifica PCM 16-bit mono como WAV — header estándar, sin dependencias. */
  function encodeWav(samples: Float32Array, sampleRate: number): Blob {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    function writeString(offset: number, str: string) {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    }

    writeString(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    return new Blob([buffer], { type: "audio/wav" });
  }

  async function transcribeAndSend(wavBlob: Blob) {
    try {
      const res = await fetch("/api/stt", {
        method: "POST",
        headers: { "Content-Type": "audio/wav" },
        body: wavBlob,
      });
      const data = await res.json();
      if (!res.ok || !data.text || !String(data.text).trim()) {
        throw new Error(data.error ?? "stt-vacio");
      }
      setInput("");
      void sendQuestion(data.text);
    } catch {
      // Whisper falló para este turno (gateway caído, modelo sin cargar,
      // etc.) — respaldo silencioso al navegador, sin romper la conversación.
      startListening();
    }
  }

  /**
   * Graba el turno de voz del usuario con detección de silencio (VAD por
   * energía) y lo manda a transcribir con Whisper. A diferencia de la Web
   * Speech API no es streaming: hay un pequeño retraso (uno-pocos segundos)
   * tras dejar de hablar antes de que el texto llegue — a cambio, Whisper
   * es mucho más robusto a hablar rápido o suave.
   */
  async function startListeningWhisper(): Promise<void> {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
      throw new Error("Captura de audio no disponible en este navegador.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const silentGain = audioCtx.createGain();
    silentGain.gain.value = 0; // el processor necesita llegar a destination para disparar onaudioprocess, pero sin sonar
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);

    let recording = false;
    let started = false;
    let startedAt = 0;
    let silenceStartedAt: number | null = null;
    let finished = false;
    const chunks: Float32Array[] = [];

    function cleanup() {
      processor.disconnect();
      silentGain.disconnect();
      source.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      audioCtx.close().catch(() => undefined);
    }

    function finish() {
      if (finished) return;
      finished = true;
      cleanup();
      if (whisperCleanupRef.current === cleanup) whisperCleanupRef.current = null;

      const durationMs = started ? Date.now() - startedAt : 0;
      if (!recording || durationMs < WHISPER_MIN_RECORDING_MS || chunks.length === 0) {
        // No hubo habla real (blip/silencio) — vuelve a escuchar sin mandar nada.
        if (conversationModeRef.current) void beginListeningTurn();
        return;
      }

      const full = concatFloat32(chunks);
      const resampled = resampleTo16k(full, audioCtx.sampleRate);
      const wavBlob = encodeWav(resampled, 16000);
      void transcribeAndSend(wavBlob);
    }

    processor.onaudioprocess = (event) => {
      if (finished) return;
      const input = event.inputBuffer.getChannelData(0);
      let sumSquares = 0;
      for (let i = 0; i < input.length; i++) sumSquares += input[i] * input[i];
      const rms = Math.sqrt(sumSquares / input.length);

      if (!recording) {
        if (rms > WHISPER_VAD_START_RMS) {
          recording = true;
          started = true;
          startedAt = Date.now();
          setAssistantState("listening");
        } else {
          return;
        }
      }

      chunks.push(input.slice());

      if (rms > WHISPER_VAD_START_RMS) {
        silenceStartedAt = null;
      } else {
        if (silenceStartedAt === null) silenceStartedAt = Date.now();
        if (Date.now() - silenceStartedAt >= WHISPER_VAD_SILENCE_MS) finish();
      }

      if (started && Date.now() - startedAt >= WHISPER_MAX_RECORDING_MS) finish();
    };

    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(audioCtx.destination);

    whisperCleanupRef.current = cleanup;
    setAssistantState("listening");
  }

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
    // Varias alternativas (no solo la mejor) para que el orquestador pueda
    // corregir/elegir la más coherente — este es el respaldo de navegador,
    // se usa solo cuando Whisper (motor principal) no está disponible.
    recognition.maxAlternatives = 5;

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript;
      const alternatives: string[] = [];
      for (let i = 0; i < result.length; i++) alternatives.push(result[i].transcript);
      setInput("");
      void sendQuestion(transcript, alternatives.length > 1 ? alternatives : undefined);
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
    stopWhisperListener();
    window.speechSynthesis?.cancel();
    setAssistantState("idle");
  }

  function toggleConversation() {
    if (conversationMode) {
      stopConversation();
    } else {
      setConversationMode(true);
      conversationModeRef.current = true;
      void beginListeningTurn();
    }
  }

  /**
   * Barge-in: escucha en PARALELO mientras Atlas habla. Al primer indicio de
   * voz del usuario (incluso un resultado parcial), interrumpe. Pedido de
   * Jorge: "si yo hablo él debería interrumpirse [solo]", sin clic manual.
   *
   * Límite honesto: el navegador cancela bastante bien el eco de su propio
   * audio de salida (Chrome/Edge lo hacen por defecto), pero sin audífonos
   * puede haber falsos positivos si el micrófono capta el altavoz. Con
   * audífonos es prácticamente perfecto.
   */
  // Nº mínimo de caracteres reconocidos para considerar que es habla real del
  // usuario y no ruido/eco de la propia voz de Atlas colándose en el micro.
  // Subido de 4 a 7: con 4, cualquier ruido puntual (silla, tos, golpe) que
  // el navegador "alucinaba" como una palabra corta ya disparaba el barge-in
  // (reportado por Jorge: "escucha el más mínimo ruido y se calla").
  const BARGE_IN_MIN_CHARS = 7;
  // Periodo de gracia tras empezar a hablar antes de armar el barge-in — el
  // primer instante de audio es el más propenso a "oírse a sí mismo".
  const BARGE_IN_ARM_DELAY_MS = 900;
  // Nº de resultados consecutivos que deben superar BARGE_IN_MIN_CHARS antes
  // de interrumpir de verdad — un ruido puntual da como mucho 1 resultado
  // "alto"; habla real del usuario da varios seguidos (la transcripción
  // interina va creciendo). Filtra falsos positivos sin perder capacidad de
  // respuesta ante habla genuina.
  const BARGE_IN_CONFIRMATIONS_NEEDED = 2;

  function startBargeInListener() {
    if (typeof window === "undefined") return;
    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return; // sin soporte: simplemente no hay barge-in, no rompe nada

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "es-ES";
    recognition.continuous = true;
    recognition.interimResults = true;

    let armed = false;
    let consecutiveHits = 0;
    const armTimer = setTimeout(() => {
      armed = true;
    }, BARGE_IN_ARM_DELAY_MS);

    recognition.onresult = (event) => {
      if (!armed) return; // todavía en periodo de gracia — ignorar
      const transcript = event.results[event.results.length - 1][0].transcript.trim();
      if (transcript.length < BARGE_IN_MIN_CHARS) {
        consecutiveHits = 0; // ruido/blip puntual, no habla real — reinicia el conteo
        return;
      }
      consecutiveHits++;
      if (consecutiveHits < BARGE_IN_CONFIRMATIONS_NEEDED) return;
      interruptAndListen();
    };
    recognition.onerror = () => {};
    recognition.onend = () => {
      clearTimeout(armTimer);
      if (bargeInRef.current === recognition) bargeInRef.current = null;
    };

    bargeInRef.current = recognition;
    try {
      recognition.start();
    } catch {
      // Ya había una instancia activa — ignorar, no es crítico.
    }
  }

  function stopBargeInListener() {
    bargeInRef.current?.stop();
    bargeInRef.current = null;
  }

  function onSpeechEnd() {
    stopBargeInListener();
    // Al terminar de hablar, si sigue en modo conversación, vuelve a
    // escuchar sola — el ciclo completo tipo Jarvis, sin tocar nada.
    if (conversationModeRef.current) {
      setTimeout(() => void beginListeningTurn(), 250);
    } else {
      setAssistantState("idle");
    }
  }

  function speakWithBrowser(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    if (voiceRef.current) utterance.voice = voiceRef.current;
    utterance.onstart = () => {
      setAssistantState("speaking");
      if (conversationModeRef.current) startBargeInListener();
    };
    utterance.onend = onSpeechEnd;
    utterance.onerror = () => setAssistantState("idle");
    window.speechSynthesis.speak(utterance);
  }

  /**
   * Voz de alta calidad (ElevenLabs, vía /api/tts) con respaldo automático
   * a la voz del navegador si no está configurada o falla — el usuario
   * nunca ve un error por esto, la conversación sigue igual.
   */
  async function speak(text: string) {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("tts-not-available");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      audio.onplay = () => {
        setAssistantState("speaking");
        if (conversationModeRef.current) startBargeInListener();
      };
      audio.onended = () => {
        URL.revokeObjectURL(url);
        currentAudioRef.current = null;
        onSpeechEnd();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        currentAudioRef.current = null;
        speakWithBrowser(text);
      };
      await audio.play();
    } catch {
      speakWithBrowser(text); // ElevenLabs no configurado o falló — respaldo silencioso
    }
  }

  /**
   * Interrumpe a Atlas a mitad de la respuesta (clic en el orbe mientras
   * habla) y pasa directo a escuchar — sin esperar a que termine de leer
   * todo el texto. Pedido explícito de Jorge: "debería poder interrumpirlo
   * sin que relea todo el texto".
   */
  function interruptAndListen() {
    if (assistantStateRef.current !== "speaking") return;
    stopBargeInListener();
    currentAudioRef.current?.pause();
    currentAudioRef.current = null;
    window.speechSynthesis?.cancel();
    if (conversationModeRef.current) {
      void beginListeningTurn();
    } else {
      setAssistantState("idle");
    }
  }

  /**
   * Sondea el estado de una tarea de desarrollo lanzada en segundo plano
   * (gateway/src/devJobs.ts) hasta que termine. No bloquea nada: la
   * conversación sigue funcionando normal mientras tanto (assistantState no
   * se toca aquí). Al terminar, el resultado se agrega al chat siempre, y
   * solo se habla en voz si Atlas está en reposo — si el usuario ya está en
   * medio de otra interacción, no se le interrumpe.
   */
  function pollDevJob(jobId: string, attempt = 0) {
    const MAX_ATTEMPTS = 300; // ~20 min a 4s por intento
    if (attempt >= MAX_ATTEMPTS) return;

    setTimeout(async () => {
      try {
        const res = await fetch(`/api/atlas/jobs/${jobId}`);
        const job = await res.json();

        if (!res.ok || job.status === "running") {
          if (res.ok) pollDevJob(jobId, attempt + 1);
          return;
        }

        const isError = job.status === "error";
        const text = isError
          ? `Tarea de desarrollo en "${job.project}" fallida: ${job.errorMessage ?? "error desconocido"}.`
          : `Terminé en "${job.project}": ${job.answer}`;

        setMessages((prev) => [
          ...prev,
          { role: "brain", text, model: job.model, isError },
        ]);
        if (assistantStateRef.current === "idle") speak(text);
      } catch {
        pollDevJob(jobId, attempt + 1);
      }
    }, 4000);
  }

  async function sendQuestion(question: string, asrAlternatives?: string[]) {
    if (!question.trim()) return;
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setAssistantState("thinking");

    try {
      const res = await fetch("/api/atlas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          outputMode: "voice",
          sessionId: sessionIdRef.current,
          asrAlternatives,
        }),
      });
      const data = await res.json();
      if (data.sessionId) sessionIdRef.current = data.sessionId;

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "brain", text: data.error ?? "Error desconocido.", isError: true },
        ]);
        setAssistantState(conversationModeRef.current ? "listening" : "idle");
        if (conversationModeRef.current) setTimeout(() => void beginListeningTurn(), 250);
        return;
      }

      const answer: string = data.answer ?? "(sin respuesta)";
      setMessages((prev) => [
        ...prev,
        { role: "brain", text: answer, citations: data.citations, model: data.model },
      ]);
      speak(answer);

      if (data.status === "running" && data.jobId) {
        pollDevJob(data.jobId);
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
        <button
          type="button"
          onClick={interruptAndListen}
          disabled={assistantState !== "speaking"}
          className="rounded-full disabled:cursor-default"
          style={{ cursor: assistantState === "speaking" ? "pointer" : "default" }}
          title={assistantState === "speaking" ? "Clic para interrumpir" : undefined}
        >
          <Orb state={assistantState} />
        </button>
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
