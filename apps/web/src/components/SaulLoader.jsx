// ─── Saúl Loader — fullscreen waiting overlay ────────────────────────────────
// Shows the Dropit mascot ("Saúl") with animated progress while the public
// form is being submitted. Replace /saul-mascot.png in /public with the
// actual cartoon to upgrade visuals; SVG fallback works out of the box.

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

const STEPS = [
  { label: "Validando tu solicitud", duration: 800 },
  { label: "Calculando ruta óptima",  duration: 1200 },
  { label: "Generando código de seguimiento", duration: 900 },
  { label: "Enviándola a nuestro equipo", duration: 1100 },
];

const MOTIVATIONAL = [
  "✨ Tu carga está en buenas manos",
  "🚛 Preparando el mejor servicio para ti",
  "📦 Confirmando todos los detalles",
  "⚡ Casi listo — un momento por favor",
];

export default function SaulLoader({ visible }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [motivationIdx, setMotivationIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  // Step progression
  useEffect(() => {
    if (!visible) {
      setCurrentStep(0);
      setProgress(0);
      return;
    }
    if (currentStep >= STEPS.length) return;
    const stepDuration = STEPS[currentStep].duration;
    const tickRate = 50;
    const totalTicks = stepDuration / tickRate;
    let tick = 0;
    const id = setInterval(() => {
      tick++;
      setProgress(Math.min(100, (tick / totalTicks) * 100));
      if (tick >= totalTicks) {
        clearInterval(id);
        setCurrentStep(s => s + 1);
        setProgress(0);
      }
    }, tickRate);
    return () => clearInterval(id);
  }, [visible, currentStep]);

  // Cycle motivational messages
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      setMotivationIdx(i => (i + 1) % MOTIVATIONAL.length);
    }, 2500);
    return () => clearInterval(id);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-dropit-50/95 via-white/95 to-amber-50/95 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md mx-4">
        {/* Floating decorative elements */}
        <div className="absolute -top-8 -left-4 h-20 w-20 rounded-full bg-dropit-accent/20 blur-2xl animate-pulse" />
        <div className="absolute -bottom-8 -right-4 h-24 w-24 rounded-full bg-amber-300/30 blur-3xl animate-pulse" />

        <div className="relative rounded-3xl border border-dropit-accent/20 bg-white p-6 shadow-2xl shadow-dropit-accent/20">
          {/* Saúl mascot */}
          <div className="flex justify-center mb-4">
            <div className="relative">
              <img
                src="/saul-mascot.png"
                alt="Saúl - Dropit Service"
                className="h-44 w-44 object-contain drop-shadow-xl animate-saul-bounce"
                onError={(e) => {
                  // Fallback: hide broken image, show SVG instead
                  e.currentTarget.style.display = "none";
                  const fallback = e.currentTarget.nextElementSibling;
                  if (fallback) fallback.style.display = "flex";
                }}
              />
              {/* SVG Fallback — Simpson-style truck driver */}
              <div className="hidden h-44 w-44 items-center justify-center" style={{ display: "none" }}>
                <svg viewBox="0 0 200 200" className="h-full w-full animate-saul-bounce">
                  {/* Body / hoodie */}
                  <rect x="60" y="110" width="80" height="70" rx="14" fill="#1f2937" />
                  {/* Star Wars text on hoodie */}
                  <text x="100" y="148" fontSize="9" fill="#fef3c7" textAnchor="middle" fontWeight="900">STAR WARS</text>
                  {/* Head (yellow) */}
                  <circle cx="100" cy="80" r="42" fill="#FCD34D" />
                  {/* Beard */}
                  <path d="M 70 90 Q 100 130 130 90 Q 130 110 100 115 Q 70 110 70 90 Z" fill="#451a03" />
                  {/* Eyes */}
                  <circle cx="86" cy="75" r="5" fill="#fff" />
                  <circle cx="114" cy="75" r="5" fill="#fff" />
                  <circle cx="86" cy="75" r="2.5" fill="#0f172a" />
                  <circle cx="114" cy="75" r="2.5" fill="#0f172a" />
                  {/* Mouth - happy */}
                  <path d="M 92 95 Q 100 102 108 95" stroke="#0f172a" strokeWidth="2" fill="none" strokeLinecap="round" />
                  {/* Cap */}
                  <path d="M 60 60 Q 60 35 100 35 Q 140 35 140 60 L 140 65 Q 100 60 60 65 Z" fill="#0f172a" />
                  <path d="M 138 58 L 165 64 L 162 70 L 138 65 Z" fill="#0f172a" />
                  {/* Dropit logo on cap */}
                  <rect x="92" y="42" width="16" height="16" rx="3" fill="#F97316" />
                  <circle cx="98" cy="48" r="1.5" fill="#fff" />
                  <path d="M 96 52 Q 100 55 104 52" stroke="#fff" strokeWidth="1" fill="none" />
                </svg>
              </div>
              {/* Speech bubble */}
              <div className="absolute -top-3 -right-12 rounded-2xl bg-white border-2 border-dropit-accent px-3 py-1.5 shadow-lg animate-bubble">
                <div className="absolute -left-1.5 top-3 h-3 w-3 rotate-45 bg-white border-l-2 border-b-2 border-dropit-accent" />
                <p className="text-xs font-black text-dropit-accent whitespace-nowrap">¡Tranqui, lo tengo!</p>
              </div>
            </div>
          </div>

          {/* Headline */}
          <h3 className="text-center text-xl font-black text-slate-900 mb-1">
            Procesando tu cotización
          </h3>
          <p className="text-center text-sm text-slate-600 mb-5 min-h-[20px]">
            {MOTIVATIONAL[motivationIdx]}
          </p>

          {/* Step list */}
          <div className="space-y-2.5 mb-4">
            {STEPS.map((step, idx) => {
              const isDone = idx < currentStep;
              const isActive = idx === currentStep;
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-all duration-300 ${
                    isActive ? "bg-dropit-accent/10 border border-dropit-accent/30" :
                    isDone ? "bg-emerald-50 border border-emerald-200" :
                    "bg-slate-50 border border-slate-100 opacity-60"
                  }`}
                >
                  <div className="flex-shrink-0">
                    {isDone ? (
                      <CheckCircle2 size={18} className="text-emerald-600" />
                    ) : isActive ? (
                      <Loader2 size={18} className="text-dropit-accent animate-spin" />
                    ) : (
                      <div className="h-[18px] w-[18px] rounded-full border-2 border-slate-300" />
                    )}
                  </div>
                  <span className={`text-sm font-semibold ${
                    isActive ? "text-dropit-accent" :
                    isDone ? "text-emerald-700" :
                    "text-slate-400"
                  }`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Active step progress bar */}
          {currentStep < STEPS.length && (
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-dropit-accent to-amber-400 transition-all duration-100 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          <p className="mt-4 text-center text-[11px] text-slate-400 font-medium">
            No cierres esta ventana · La cotización está en proceso
          </p>
        </div>
      </div>

      <style>{`
        @keyframes saul-bounce {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-8px) rotate(2deg); }
        }
        @keyframes bubble {
          0%, 100% { transform: scale(1) rotate(-3deg); }
          50% { transform: scale(1.05) rotate(3deg); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-saul-bounce { animation: saul-bounce 2.4s ease-in-out infinite; }
        .animate-bubble { animation: bubble 1.8s ease-in-out infinite; }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}
