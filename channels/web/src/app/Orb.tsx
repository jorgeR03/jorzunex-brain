"use client";

export type AssistantState = "idle" | "listening" | "thinking" | "speaking";

const STATE_LABEL: Record<AssistantState, string> = {
  idle: "Atlas en espera",
  listening: "Escuchando…",
  thinking: "Pensando…",
  speaking: "Hablando… (clic para interrumpir)",
};

/**
 * Orbe "Atlas" — adaptado del componente open-source SiriOrb de SmoothUI
 * (https://smoothui.dev/docs/components/siri-orb, fetched directamente del
 * repo educlopez/smoothui vía GitHub — licencia MIT, sin dependencias
 * nuevas: es CSS puro con `@property --angle` para animar un
 * conic-gradient). Coloreado con la paleta real de JorZunex (cian/azul/
 * púrpura, ver globals.css) y con la velocidad/glow moduladas por el
 * estado del asistente en vez de un size/color fijo.
 */
export function Orb({ state }: { state: AssistantState }) {
  const duration = state === "speaking" ? 3 : state === "listening" ? 5 : state === "thinking" ? 4 : 14;
  const glow =
    state === "speaking"
      ? "0 0 70px 14px rgba(0,200,255,.55), 0 0 24px 6px rgba(123,79,255,.5)"
      : state === "listening"
        ? "0 0 55px 10px rgba(0,200,255,.45)"
        : state === "thinking"
          ? "0 0 45px 8px rgba(123,79,255,.4)"
          : "0 0 28px 4px rgba(0,200,255,.22)";

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="atlas-orb"
        style={
          {
            width: "160px",
            height: "160px",
            "--bg": "#040810",
            "--c1": "#00c8ff",
            "--c2": "#3d6eff",
            "--c3": "#7b4fff",
            "--animation-duration": `${duration}s`,
            boxShadow: glow,
            transition: "box-shadow 0.4s ease",
          } as React.CSSProperties
        }
      />
      <span className="text-xs" style={{ color: "var(--text-dim)" }}>
        {STATE_LABEL[state]}
      </span>

      <style>{`
        @property --angle {
          syntax: "<angle>";
          inherits: false;
          initial-value: 0deg;
        }

        .atlas-orb {
          display: grid;
          grid-template-areas: "stack";
          overflow: hidden;
          border-radius: 50%;
          position: relative;
        }

        .atlas-orb::before,
        .atlas-orb::after {
          content: "";
          display: block;
          grid-area: stack;
          width: 100%;
          height: 100%;
          border-radius: 50%;
        }

        .atlas-orb::before {
          background:
            conic-gradient(from calc(var(--angle) * 2) at 25% 70%, var(--c3), transparent 20% 80%, var(--c3)),
            conic-gradient(from calc(var(--angle) * 2) at 45% 75%, var(--c2), transparent 30% 60%, var(--c2)),
            conic-gradient(from calc(var(--angle) * -3) at 80% 20%, var(--c1), transparent 40% 60%, var(--c1)),
            conic-gradient(from calc(var(--angle) * 2) at 15% 5%, var(--c2), transparent 10% 90%, var(--c2)),
            conic-gradient(from calc(var(--angle) * 1) at 20% 80%, var(--c1), transparent 10% 90%, var(--c1)),
            conic-gradient(from calc(var(--angle) * -2) at 85% 10%, var(--c3), transparent 20% 80%, var(--c3));
          box-shadow: inset var(--bg) 0 0 12px 2px;
          filter: blur(2px) contrast(1.6);
          animation: atlas-rotate var(--animation-duration) linear infinite;
        }

        .atlas-orb::after {
          background-image: radial-gradient(circle at center, var(--bg) 0.12px, transparent 0.12px);
          background-size: 3px 3px;
          backdrop-filter: blur(3px) contrast(2.2);
          mix-blend-mode: overlay;
          mask-image: radial-gradient(black 25%, transparent 75%);
        }

        @keyframes atlas-rotate {
          to {
            --angle: 360deg;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .atlas-orb::before {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
