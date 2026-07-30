/**
 * Tipos mínimos de la Web Speech API (SpeechRecognition) — no está en
 * lib.dom.d.ts de TypeScript porque es una API no estandarizada (solo
 * Chrome/Edge/Android la implementan vía el prefijo webkitSpeechRecognition).
 * Ver docs/adr/ADR-0002-asistente-de-voz.md, escalón A.
 */
export {};

interface SpeechRecognitionEventLike extends Event {
  results: {
    [index: number]: { [index: number]: { transcript: string }; isFinal: boolean };
    length: number;
  };
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}
