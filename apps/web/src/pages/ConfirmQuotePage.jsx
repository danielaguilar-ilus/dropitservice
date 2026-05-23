import { useEffect, useState } from "react";
import {
  CheckCircle2, AlertCircle, Loader2, MapPin, Package,
  Truck, Clock, ArrowRight, ChevronRight,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export default function ConfirmQuotePage() {
  const params = new URLSearchParams(window.location.search);
  const id    = params.get("id");
  const token = params.get("token");

  const [quote, setQuote]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed]   = useState(false);

  useEffect(() => {
    if (!id) { setError("Link inválido — falta el ID de la solicitud."); setLoading(false); return; }
    fetch(`${API_URL}/quote-requests/${id}/public?token=${encodeURIComponent(token || "")}`)
      .then(r => r.json())
      .then(data => {
        if (data.request) {
          setQuote(data.request);
          if (data.request.status === "Aceptado por cliente") setConfirmed(true);
        } else {
          setError(data.message || "No se pudo cargar la cotización.");
        }
      })
      .catch(() => setError("No se pudo conectar con el servidor. Intenta más tarde."))
      .finally(() => setLoading(false));
  }, [id, token]);

  async function handleConfirm() {
    if (!id || confirming) return;
    setConfirming(true);
    try {
      const res = await fetch(`${API_URL}/quote-requests/${id}/accept`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al confirmar");
      setQuote(data.request);
      setConfirmed(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="min-h-screen bg-dropit-100 font-sans">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-dropit-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 overflow-hidden rounded-lg bg-dropit-accent shadow-sm">
              <img src="/dropit-logo.jpeg" alt="DropIt" className="h-full w-full object-cover" />
            </div>
            <span className="text-lg font-black text-dropit-950">
              Drop<span className="text-dropit-accent">It</span>
            </span>
          </div>
          <a
            href="/cotizar"
            className="flex items-center gap-1 text-sm font-semibold text-dropit-accent hover:underline"
          >
            Nueva cotización <ChevronRight size={14} />
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-12">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Loader2 size={40} className="animate-spin text-dropit-accent mb-4" />
            <p className="text-dropit-700 font-medium">Cargando tu cotización...</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-2xl border border-dropit-error/30 bg-dropit-error/5 p-8 text-center">
            <AlertCircle size={40} className="mx-auto mb-4 text-dropit-error" />
            <h2 className="text-xl font-black text-dropit-950 mb-2">No se pudo cargar</h2>
            <p className="text-dropit-700">{error}</p>
            <a href="/cotizar" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-dropit-accent px-6 py-3 text-sm font-bold text-white hover:bg-dropit-accent-dark transition-colors">
              Volver a cotizar
            </a>
          </div>
        )}

        {/* Confirmed success state */}
        {!loading && !error && confirmed && quote && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-dropit-success/30 bg-dropit-success/5 p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-dropit-success text-white">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="text-2xl font-black text-dropit-950">¡Cotización confirmada!</h2>
              <p className="mt-2 text-dropit-700">
                Recibimos tu confirmación. Nuestro equipo coordinará el retiro contigo.
              </p>
              <div className="mt-6 grid gap-3 md:grid-cols-2 text-left">
                <InfoBlock label="Código de seguimiento" value={<span className="font-mono text-lg font-black text-dropit-accent">{quote.trackingCode}</span>} />
                <InfoBlock label="Valor confirmado" value={<span className="text-lg font-black text-dropit-success">${Number(quote.quotedAmount).toLocaleString("es-CL")}</span>} />
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-dropit-300 p-6 space-y-3">
              <h3 className="text-sm font-bold text-dropit-700 uppercase tracking-wider mb-4">Detalle del servicio</h3>
              <InfoRow icon={MapPin} label="Retiro" value={quote.pickupAddress} />
              <InfoRow icon={MapPin} label="Entrega" value={quote.deliveryAddress} accent />
              <InfoRow icon={Package} label="Carga" value={`${quote.packages} bultos · ${quote.estimatedWeightKg} kg`} />
              {quote.requiredDate && <InfoRow icon={Clock} label="Fecha" value={quote.requiredDate} />}
              {quote.serviceType && <InfoRow icon={Truck} label="Servicio" value={quote.serviceType} />}
            </div>

            <div className="rounded-2xl bg-dropit-950 p-6 text-white text-center">
              <p className="text-sm text-dropit-400 mb-3">Haz seguimiento de tu pedido en tiempo real</p>
              <a
                href="/cotizar"
                className="inline-flex items-center gap-2 rounded-xl bg-dropit-accent px-6 py-3 text-sm font-bold text-white hover:bg-dropit-accent-dark transition-colors"
              >
                Ir al tracking <ArrowRight size={16} />
              </a>
            </div>
          </div>
        )}

        {/* Pending confirmation */}
        {!loading && !error && !confirmed && quote && (
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-dropit-accent/10">
                <Truck size={28} className="text-dropit-accent" />
              </div>
              <h1 className="text-3xl font-black text-dropit-950">Tu cotización está lista</h1>
              <p className="mt-2 text-dropit-700">Revisa los detalles y confirma para agendar el retiro</p>
            </div>

            {/* Price card */}
            <div className="rounded-2xl bg-dropit-950 text-white overflow-hidden">
              <div className="bg-gradient-to-r from-dropit-accent to-dropit-accent-dark px-6 py-5 text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-white/80 mb-1">Valor total del servicio</p>
                <p className="text-5xl font-black tracking-tight">
                  ${Number(quote.quotedAmount).toLocaleString("es-CL")}
                  <span className="text-lg font-semibold opacity-75 ml-2">CLP</span>
                </p>
                {quote.serviceType && <p className="mt-2 text-sm text-white/75">{quote.serviceType}</p>}
              </div>
              <div className="px-6 py-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-dropit-500 text-xs uppercase tracking-wider mb-0.5">Código</p>
                  <p className="font-mono font-bold text-dropit-accent">{quote.trackingCode}</p>
                </div>
                <div>
                  <p className="text-dropit-500 text-xs uppercase tracking-wider mb-0.5">Cliente</p>
                  <p className="font-semibold text-white">{quote.customerName}</p>
                </div>
              </div>
            </div>

            {/* Service details */}
            <div className="rounded-2xl bg-white border border-dropit-300 p-6 space-y-3">
              <h3 className="text-sm font-bold text-dropit-700 uppercase tracking-wider mb-4">Detalle del servicio</h3>
              <InfoRow icon={MapPin} label="Dirección de retiro" value={quote.pickupAddress} />
              <InfoRow icon={MapPin} label="Dirección de entrega" value={quote.deliveryAddress} accent />
              <InfoRow icon={Package} label="Carga" value={`${quote.packages} bultos · ${quote.estimatedWeightKg} kg`} />
              {quote.requiredDate && (
                <InfoRow icon={Clock} label="Fecha requerida" value={`${quote.requiredDate}${quote.requiredTime ? ` · ${quote.requiredTime}` : ""}`} />
              )}
              {quote.distanceKm && (
                <InfoRow icon={Truck} label="Distancia" value={`${quote.distanceKm} km`} />
              )}
              {quote.internalNotes && (
                <div className="mt-3 rounded-xl bg-dropit-accent/5 border border-dropit-accent/20 p-4">
                  <p className="text-xs font-bold text-dropit-accent uppercase tracking-wider mb-1">Comentario del operador</p>
                  <p className="text-sm text-dropit-950">{quote.internalNotes}</p>
                </div>
              )}
            </div>

            {/* Terms */}
            <div className="rounded-xl bg-dropit-200/50 border border-dropit-300 p-4 text-xs text-dropit-700">
              <p>
                ⏱ Esta cotización tiene <strong>validez de 24 horas</strong> desde su emisión.
                El precio final puede variar si cambian las condiciones de acceso o la carga.
                Al confirmar, aceptas los términos de servicio de DropIt Service.
              </p>
            </div>

            {/* CTA */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-dropit-accent px-8 py-5 text-lg font-black text-white shadow-xl shadow-dropit-accent/30 hover:bg-dropit-accent-dark transition-all hover:scale-[1.02] disabled:opacity-60 disabled:scale-100 disabled:cursor-not-allowed"
              >
                {confirming ? (
                  <><Loader2 size={22} className="animate-spin" /> Confirmando...</>
                ) : (
                  <><CheckCircle2 size={22} /> Confirmar cotización</>
                )}
              </button>
              <a
                href={`mailto:soporte@dropit.cl?subject=Consulta cotización ${quote.trackingCode}`}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dropit-400 bg-white px-8 py-4 text-sm font-semibold text-dropit-950 hover:bg-dropit-100 transition-colors"
              >
                Tengo dudas — contactar al equipo
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, accent = false }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-dropit-100 last:border-0">
      <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${accent ? "bg-dropit-accent/10" : "bg-dropit-100"}`}>
        <Icon size={13} className={accent ? "text-dropit-accent" : "text-dropit-600"} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-dropit-600 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-dropit-950 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function InfoBlock({ label, value }) {
  return (
    <div className="rounded-xl bg-white border border-dropit-300 p-4">
      <p className="text-xs font-semibold text-dropit-600 uppercase tracking-wider mb-1">{label}</p>
      <div>{value}</div>
    </div>
  );
}
