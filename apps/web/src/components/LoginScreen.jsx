import { useEffect, useState } from "react";
import { MapPin, Clock, Zap, Shield, ChevronRight, Truck } from "lucide-react";

function useCarousel() {
  const [images, setImages] = useState([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("dropit-login-carousel") || "[]");
      setImages(Array.isArray(stored) ? stored : []);
    } catch {
      setImages([]);
    }
  }, []);

  useEffect(() => {
    if (images.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % images.length), 5000);
    return () => clearInterval(id);
  }, [images.length]);

  return { images, index };
}

export default function LoginScreen({ credentials, onChange, onSubmit, error, loading }) {
  const { images, index } = useCarousel();
  const hasCarousel = images.length > 0;

  return (
    <main className="grid min-h-screen overflow-hidden lg:grid-cols-[1fr_480px]">
      {/* Left — Brand panel */}
      <section className="relative flex flex-col justify-between overflow-hidden bg-dropit-950 px-8 py-10 text-white lg:px-16">
        {/* Carousel images — blurred fill + object-contain main */}
        {hasCarousel && images.map((src, i) => (
          <div
            key={i}
            className="pointer-events-none absolute inset-0 transition-opacity duration-1000"
            style={{ opacity: i === index ? 1 : 0 }}
          >
            {/* Blurred fill for letterbox areas */}
            <div className="absolute inset-0 scale-110 bg-cover bg-center blur-md opacity-50" style={{ backgroundImage: `url(${src})` }} />
            {/* Main image contained — no cropping */}
            <img src={src} className="absolute inset-0 h-full w-full object-contain" alt="" />
          </div>
        ))}

        {/* Dark overlay — gradient stronger toward center for text legibility */}
        <div className="pointer-events-none absolute inset-0" style={{
          background: hasCarousel
            ? "linear-gradient(to right, rgba(12,8,4,0.70) 0%, rgba(12,8,4,0.57) 55%, rgba(12,8,4,0.40) 100%)"
            : "transparent"
        }}>
          {!hasCarousel && (
            <>
              <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-dropit-accent/10 blur-3xl" />
              <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-dropit-accent/5 blur-3xl" />
              <div className="absolute right-1/4 top-1/2 h-64 w-64 rounded-full bg-dropit-accent/5 blur-2xl" />
            </>
          )}
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-dropit-accent shadow-xl shadow-dropit-accent/40">
            <img src="/dropit-logo.jpeg" alt="DropIt" className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-dropit-accent">DropIt Service</p>
            <p className="text-sm text-dropit-400">Gestión logística de última milla</p>
          </div>
        </div>

        {/* Center content */}
        <div className="relative">
          <h1 className="text-5xl font-black leading-tight tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
            Control total<br />
            <span className="text-dropit-accent">de tu flota.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-white/80 drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
            Cotiza, planifica rutas optimizadas, asigna camiones y entrega seguimiento
            en tiempo real a cada cliente. Todo en un solo panel.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { icon: MapPin, value: "Todo Chile", label: "Cobertura" },
              { icon: Clock, value: "24/7", label: "Tracking en vivo" },
              { icon: Zap, value: "<1 hora", label: "Cotización" },
              { icon: Shield, value: "100%", label: "Carga asegurada" },
            ].map(({ icon: Icon, value, label }) => (
              <div
                key={label}
                className="rounded-xl border border-white/8 bg-white/5 p-4 backdrop-blur-sm transition hover:border-dropit-accent/40 hover:bg-white/8"
              >
                <Icon size={18} className="mb-3 text-dropit-accent" />
                <p className="text-2xl font-black">{value}</p>
                <p className="mt-0.5 text-xs text-dropit-500">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom — link + carousel dots */}
        <div className="relative flex items-center justify-between">
          <a
            href="/cotizar"
            className="inline-flex items-center gap-2 text-sm font-semibold text-dropit-accent hover:underline"
          >
            ¿Eres cliente? Solicita una cotización
            <ChevronRight size={16} />
          </a>
          {hasCarousel && images.length > 1 && (
            <div className="flex gap-1.5">
              {images.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    i === index ? "w-5 bg-dropit-accent" : "w-1.5 bg-white/30"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Right — Login form */}
      <section className="flex items-center justify-center bg-dropit-100 px-8 py-10">
        <div className="w-full max-w-sm space-y-8">
          <div>
            <div className="mb-5 overflow-hidden rounded-2xl shadow-lg shadow-dropit-accent/20" style={{ width: 72, height: 72 }}>
              <img src="/dropit-logo.jpeg" alt="DropIt" className="h-full w-full object-cover" />
            </div>
            <h2 className="text-3xl font-black text-dropit-950">Bienvenido</h2>
            <p className="mt-1.5 text-sm text-dropit-700">
              Ingresa tus credenciales para acceder al panel operativo
            </p>
          </div>

          <form className="space-y-5" onSubmit={onSubmit}>
            <div>
              <label className="label-base" htmlFor="email">Correo electrónico</label>
              <input
                id="email"
                type="email"
                className="input-base"
                placeholder="tu@empresa.cl"
                value={credentials.email}
                onChange={(e) => onChange("email", e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="label-base mb-0" htmlFor="password">Contraseña</label>
                <button
                  type="button"
                  className="text-xs font-semibold text-dropit-accent hover:underline"
                  onClick={() => alert("Próximamente: recuperación de contraseña")}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <input
                id="password"
                type="password"
                className="input-base"
                placeholder="••••••••"
                value={credentials.password}
                onChange={(e) => onChange("password", e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-dropit-error/30 bg-dropit-error/8 px-4 py-3">
                <p className="text-sm font-medium text-dropit-error">{error}</p>
              </div>
            )}

            <button className="btn-primary w-full gap-2 py-3 text-base" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Verificando...
                </>
              ) : (
                <>
                  <Truck size={18} />
                  Acceder al panel
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-dropit-600">
            Al ingresar aceptas los{" "}
            <a href="#" className="font-semibold text-dropit-accent hover:underline">términos de uso</a>{" "}
            de DropIt Service
          </p>
        </div>
      </section>
    </main>
  );
}
