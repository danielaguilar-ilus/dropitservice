// ─── SaulLoader — Premium fullscreen submission overlay ──────────────────────
// Dark immersive design: radial gradient background, orbiting rings around the
// Dropit logo, rotating titles and step subtitles, animated progress bar.
// Signature: SaulLoader({ visible }) — unchanged. Import in PublicQuotePage.jsx.

import { useEffect, useState } from "react";
import { Truck } from "lucide-react";

// Each slide pairs a large rotating headline with a step subtitle
const SLIDES = [
  { title: "Optimizando tu ruta",         step: "Validando datos" },
  { title: "Trazando el mejor camino",    step: "Calculando distancia" },
  { title: "Asegurando tu carga",         step: "Generando seguimiento" },
  { title: "Casi listo",                  step: "Enviando a nuestro equipo" },
];

// Total loader duration the form enforces: ~4 000 ms
const TOTAL_MS = 4000;
// Progress bar: eases from 0 to ~96% in TOTAL_MS, then holds at 98% until hidden
const TICK_MS  = 40;

export default function SaulLoader({ visible }) {
  const [slideIdx,    setSlideIdx]    = useState(0);
  const [progress,    setProgress]    = useState(0);
  const [logoError,   setLogoError]   = useState(false);

  // Reset everything when loader becomes invisible
  useEffect(() => {
    if (!visible) {
      setSlideIdx(0);
      setProgress(0);
      setLogoError(false);
    }
  }, [visible]);

  // Cycle slides every ~1 250 ms while visible
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      setSlideIdx(i => (i + 1) % SLIDES.length);
    }, 1250);
    return () => clearInterval(id);
  }, [visible]);

  // Smooth progress bar: 0 → ~96% over TOTAL_MS, then clamps at 98%
  useEffect(() => {
    if (!visible) return;
    let elapsed = 0;
    const id = setInterval(() => {
      elapsed += TICK_MS;
      // Ease-out curve: progress = 1 - e^(-k*t)
      const t   = Math.min(elapsed / TOTAL_MS, 1);
      const raw = 1 - Math.exp(-3.5 * t); // reaches ~97% at t=1
      setProgress(Math.min(98, Math.round(raw * 100)));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [visible]);

  if (!visible) return null;

  const { title, step } = SLIDES[slideIdx];

  return (
    <div
      className="sl-root"
      role="status"
      aria-label="Procesando tu cotización"
      aria-live="polite"
    >
      {/* ── Orbit stage ── */}
      <div className="sl-stage">

        {/* Pulsing radial glow behind logo */}
        <div className="sl-glow" />

        {/* Outer dashed ring — slow counter-clockwise rotation */}
        <div className="sl-ring-dashed" />

        {/* Orange arc spinner — fast clockwise */}
        <div className="sl-ring-arc" />

        {/* Truck badge on the orbit (upper-right position, fixed with pulse) */}
        <div className="sl-badge">
          <Truck size={16} strokeWidth={2.5} color="#fff" />
        </div>

        {/* Logo container */}
        <div className="sl-logo-box">
          {logoError ? (
            /* Fallback when image 404s */
            <div className="sl-logo-fallback">
              <span className="sl-logo-fallback-text">Dropit</span>
            </div>
          ) : (
            <img
              src="/dropit-logo.jpeg"
              alt="Dropit Service"
              className="sl-logo-img"
              onError={() => setLogoError(true)}
            />
          )}
        </div>
      </div>

      {/* ── Text block ── */}
      <div className="sl-text">
        <p className="sl-label">CALCULANDO TU COTIZACION</p>

        {/* Key: forces re-mount + fade-in animation on every slide change */}
        <h2 key={`title-${slideIdx}`} className="sl-title sl-fadein">
          {title}&hellip;
        </h2>

        <p key={`step-${slideIdx}`} className="sl-subtitle sl-fadein">
          <span className="sl-dot" />
          {step}
        </p>
      </div>

      {/* ── Progress bar ── */}
      <div className="sl-bar-track">
        <div
          className="sl-bar-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* ── Keyframes + scoped styles ── */}
      <style>{`
        /* ── Root overlay ─────────────────────────────────────────────────────── */
        .sl-root {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 36px;
          /* Dark radial background: deep brown/black feel */
          background: radial-gradient(ellipse 80% 70% at 50% 40%, #1a0f05 0%, #0d0603 55%, #000000 100%);
          padding: 24px 16px;
          /* Entrance animation */
          animation: sl-enter 0.35s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes sl-enter {
          from { opacity: 0; transform: scale(1.04); }
          to   { opacity: 1; transform: scale(1); }
        }

        /* ── Orbit stage ──────────────────────────────────────────────────────── */
        .sl-stage {
          position: relative;
          width: 200px;
          height: 200px;
          flex-shrink: 0;
        }

        /* ── Glow ─────────────────────────────────────────────────────────────── */
        .sl-glow {
          position: absolute;
          inset: 20px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(249,115,22,0.28) 0%, transparent 70%);
          animation: sl-pulse-glow 2.4s ease-in-out infinite;
        }
        @keyframes sl-pulse-glow {
          0%, 100% { transform: scale(1);    opacity: 0.7; }
          50%       { transform: scale(1.18); opacity: 1;   }
        }

        /* ── Dashed outer ring ────────────────────────────────────────────────── */
        .sl-ring-dashed {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px dashed rgba(249,115,22,0.35);
          animation: sl-spin-ccw 12s linear infinite;
        }
        @keyframes sl-spin-ccw {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }

        /* ── Orange arc spinner ───────────────────────────────────────────────── */
        .sl-ring-arc {
          position: absolute;
          inset: 8px;
          border-radius: 50%;
          border: 3px solid transparent;
          border-top-color: #f97316;
          border-right-color: rgba(249,115,22,0.45);
          animation: sl-spin-cw 1.4s linear infinite;
          box-shadow: 0 0 14px 2px rgba(249,115,22,0.25);
        }
        @keyframes sl-spin-cw {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        /* ── Truck badge ──────────────────────────────────────────────────────── */
        .sl-badge {
          position: absolute;
          /* Upper-right quadrant of the orbit circle */
          top: 14px;
          right: 14px;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: #f97316;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 0 3px rgba(249,115,22,0.3), 0 0 18px 4px rgba(249,115,22,0.4);
          animation: sl-pulse-badge 2s ease-in-out infinite;
          /* Sit above the rings */
          z-index: 2;
        }
        @keyframes sl-pulse-badge {
          0%, 100% { box-shadow: 0 0 0 3px rgba(249,115,22,0.3), 0 0 18px 4px rgba(249,115,22,0.4); }
          50%       { box-shadow: 0 0 0 6px rgba(249,115,22,0.2), 0 0 28px 8px rgba(249,115,22,0.55); }
        }

        /* ── Logo box ─────────────────────────────────────────────────────────── */
        .sl-logo-box {
          position: absolute;
          /* Centered inside the 200px stage */
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 108px;
          height: 108px;
          border-radius: 22px;
          background: #110a04;
          /* Orange ring glow */
          box-shadow:
            0 0 0 2px rgba(249,115,22,0.55),
            0 0 24px 6px rgba(249,115,22,0.3),
            0 8px 32px rgba(0,0,0,0.8);
          overflow: hidden;
          z-index: 1;
        }
        .sl-logo-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 20px;
        }
        .sl-logo-fallback {
          width: 100%;
          height: 100%;
          background: #f97316;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sl-logo-fallback-text {
          color: #fff;
          font-size: 15px;
          font-weight: 900;
          letter-spacing: 0.04em;
        }

        /* ── Text block ───────────────────────────────────────────────────────── */
        .sl-text {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          text-align: center;
          max-width: 320px;
          width: 100%;
        }

        .sl-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.2em;
          color: #f97316;
          text-transform: uppercase;
          margin: 0;
        }

        .sl-title {
          font-size: clamp(22px, 5vw, 28px);
          font-weight: 900;
          color: #ffffff;
          margin: 0;
          line-height: 1.15;
          letter-spacing: -0.01em;
        }

        .sl-subtitle {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 500;
          color: rgba(255,255,255,0.55);
          margin: 0;
        }

        .sl-dot {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #f97316;
          flex-shrink: 0;
          animation: sl-pulse-dot 1.1s ease-in-out infinite;
        }
        @keyframes sl-pulse-dot {
          0%, 100% { opacity: 1;   transform: scale(1);    }
          50%       { opacity: 0.4; transform: scale(0.65); }
        }

        /* Fade-in for swapping title/subtitle */
        .sl-fadein {
          animation: sl-text-fade 0.35s ease-out both;
        }
        @keyframes sl-text-fade {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }

        /* ── Progress bar ─────────────────────────────────────────────────────── */
        .sl-bar-track {
          width: min(320px, calc(100vw - 48px));
          height: 6px;
          border-radius: 999px;
          background: rgba(255,255,255,0.1);
          overflow: hidden;
        }
        .sl-bar-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #f97316 0%, #fb923c 60%, #fbbf24 100%);
          /* Smooth width transitions */
          transition: width ${TICK_MS}ms linear;
          box-shadow: 0 0 10px 2px rgba(249,115,22,0.45);
        }

        /* ── Mobile safety ────────────────────────────────────────────────────── */
        @media (max-width: 360px) {
          .sl-stage { width: 172px; height: 172px; }
          .sl-logo-box { width: 90px; height: 90px; }
        }
      `}</style>
    </div>
  );
}
