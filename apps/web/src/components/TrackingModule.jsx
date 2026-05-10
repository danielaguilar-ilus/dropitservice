import { Search, MapPin, Package, CheckCircle2, Circle, Navigation } from "lucide-react";
import { useState } from "react";
import StatusBadge from "./StatusBadge";

export default function TrackingModule({ onSearchTracking }) {
  const [code, setCode] = useState("DRP-1001");
  const [tracking, setTracking] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      setTracking(await onSearchTracking(code));
    } catch (trackingError) {
      setTracking(null);
      setError(trackingError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[380px_1fr]">
      {/* Search Panel */}
      <form className="surface overflow-hidden" onSubmit={submit}>
        <div className="border-b border-dropit-300 bg-dropit-50 px-5 py-4">
          <h3 className="text-lg font-bold text-dropit-950">Seguimiento de pedido</h3>
          <p className="mt-1 text-sm text-dropit-700">
            Ingresa el código de seguimiento o ID de solicitud
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="label-base">Código de tracking</label>
            <input
              className="input-base font-mono"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Ej: DRP-1001"
            />
          </div>

          <button className="btn-primary w-full gap-2" type="submit" disabled={loading}>
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Buscando...
              </>
            ) : (
              <>
                <Search size={16} />
                Buscar pedido
              </>
            )}
          </button>

          {error && (
            <div className="rounded-md border border-dropit-error/30 bg-dropit-error/10 p-3">
              <p className="text-sm font-medium text-dropit-error">{error}</p>
            </div>
          )}

          <div className="rounded-md border border-dropit-300 bg-dropit-100/30 p-3 text-xs text-dropit-700">
            <p className="font-semibold mb-1">Ejemplo de códigos:</p>
            <p className="font-mono">DRP-1001, DRP-1002, SOL-1001</p>
          </div>
        </div>
      </form>

      {/* Tracking Result */}
      <article className="surface overflow-hidden">
        {tracking ? (
          <>
            {/* Header */}
            <div className="border-b border-dropit-300 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-dropit-950">{tracking.customerName}</h3>
                  <p className="mt-1 font-mono text-sm text-dropit-700">
                    {tracking.id} · {tracking.trackingCode}
                  </p>
                </div>
                <StatusBadge status={tracking.status} size="lg" />
              </div>
            </div>

            <div className="p-5 space-y-6">
              {/* Info Cards */}
              <div className="grid gap-3 md:grid-cols-3">
                <InfoCard icon={MapPin} label="Dirección de retiro" value={tracking.pickupAddress} />
                <InfoCard icon={Navigation} label="Dirección de entrega" value={tracking.deliveryAddress} />
                <InfoCard icon={Package} label="Ubicación actual" value={tracking.approximateLocation} highlight />
              </div>

              {/* Timeline */}
              <div>
                <h4 className="mb-4 font-bold text-dropit-950">Línea de tiempo</h4>
                <div className="relative space-y-1">
                  {tracking.visibleStatuses.map((status, idx) => {
                    const currentIdx = tracking.visibleStatuses.indexOf(tracking.status);
                    const active = status === tracking.status;
                    const reached = idx <= currentIdx;
                    const isLast = idx === tracking.visibleStatuses.length - 1;

                    return (
                      <div key={status} className="flex gap-4">
                        {/* Icon column */}
                        <div className="flex flex-col items-center">
                          <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                            active
                              ? "border-dropit-accent bg-dropit-accent text-white"
                              : reached
                              ? "border-dropit-accent/60 bg-dropit-accent/10 text-dropit-accent"
                              : "border-dropit-400 bg-dropit-200 text-dropit-500"
                          }`}>
                            {reached ? (
                              <CheckCircle2 size={16} />
                            ) : (
                              <Circle size={16} />
                            )}
                          </div>
                          {!isLast && (
                            <div className={`mt-1 w-0.5 flex-1 min-h-4 ${reached ? "bg-dropit-accent/40" : "bg-dropit-300"}`} />
                          )}
                        </div>

                        {/* Content */}
                        <div className={`mb-2 flex-1 rounded-lg border px-4 py-3 transition-colors ${
                          active
                            ? "border-dropit-accent/40 bg-dropit-accent/5"
                            : reached
                            ? "border-dropit-accent/20 bg-dropit-100/30"
                            : "border-dropit-300 bg-white"
                        }`}>
                          <span className={`text-sm font-semibold ${
                            active ? "text-dropit-accent" : reached ? "text-dropit-800" : "text-dropit-500"
                          }`}>
                            {status}
                          </span>
                          {active && (
                            <span className="ml-2 rounded-full bg-dropit-accent px-2 py-0.5 text-xs font-bold text-white">
                              Actual
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state m-6">
            <Search className="empty-state-icon" size={32} />
            <p className="empty-state-title">Sin resultados aún</p>
            <p className="empty-state-description">
              Ingresa un código de tracking para ver el estado del pedido
            </p>
          </div>
        )}
      </article>
    </section>
  );
}

function InfoCard({ icon: Icon, label, value, highlight = false }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-dropit-accent/30 bg-dropit-accent/5" : "border-dropit-300 bg-dropit-100/20"}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className={highlight ? "text-dropit-accent" : "text-dropit-600"} />
        <p className="text-xs font-semibold uppercase tracking-wider text-dropit-700">{label}</p>
      </div>
      <p className={`text-sm font-medium ${highlight ? "text-dropit-accent" : "text-dropit-950"}`}>
        {value || "Sin información"}
      </p>
    </div>
  );
}
