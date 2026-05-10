import {
  AlertCircle, Camera, CheckCircle2, ChevronDown, ChevronRight,
  Clock, MapPin, Navigation, Package, Phone, Truck, User, X, Pen,
  Play, RotateCw, Satellite,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import DriverNavigationMode from "./DriverNavigationMode";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

// ─── Razones de fallo (editables por admin en localStorage) ──────────────────
const DEFAULT_FAILURE_REASONS = [
  "Local cerrado",
  "Dirección incorrecta / no encontrada",
  "Cliente desconoce el pedido",
  "Cliente no se encontraba",
  "Acceso no permitido al edificio",
  "El cliente rechazó el pedido",
  "Problema con el pago",
  "Carga dañada en tránsito",
  "Otro (especificar en observaciones)",
];

function getFailureReasons() {
  try {
    const saved = localStorage.getItem("dropit-failure-reasons");
    return saved ? JSON.parse(saved) : DEFAULT_FAILURE_REASONS;
  } catch { return DEFAULT_FAILURE_REASONS; }
}

// ─── Signature Pad ────────────────────────────────────────────────────────────
function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const t = e.touches?.[0] || e;
    return {
      x: (t.clientX - rect.left) * scaleX,
      y: (t.clientY - rect.top) * scaleY,
    };
  }

  function setupCtx() {
    const ctx = canvasRef.current.getContext("2d");
    ctx.strokeStyle = "#1e3a5f";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return ctx;
  }

  function start(e) {
    e.preventDefault();
    drawing.current = true;
    const ctx = setupCtx();
    const { x, y } = getPos(e, canvasRef.current);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = setupCtx();
    const { x, y } = getPos(e, canvasRef.current);
    ctx.lineTo(x, y);
    ctx.stroke();
    const dataUrl = canvasRef.current.toDataURL();
    setHasSignature(true);
    onChange(dataUrl);
  }

  function end() { drawing.current = false; }

  function clear() {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasSignature(false);
    onChange("");
  }

  return (
    <div>
      <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-white overflow-hidden" style={{ height: 140 }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={140}
          className="w-full h-full cursor-crosshair touch-none"
          onMouseDown={start}
          onMouseMove={draw}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={draw}
          onTouchEnd={end}
        />
        {!hasSignature && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="flex items-center gap-1.5 text-sm text-slate-300">
              <Pen size={14} />Firme aquí
            </p>
          </div>
        )}
      </div>
      <button type="button" onClick={clear} className="mt-1 text-[10px] font-semibold text-slate-400 hover:text-red-500 transition-colors">
        ✕ Limpiar firma
      </button>
    </div>
  );
}

// ─── Delivery Confirmation Modal ──────────────────────────────────────────────
function DeliveryModal({ stop, onClose, onConfirm }) {
  const [photos, setPhotos] = useState([]);
  const [signature, setSignature] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientRut, setRecipientRut] = useState("");
  const [observations, setObservations] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const photoInputRef = useRef(null);

  function handlePhotoUpload(e) {
    const files = Array.from(e.target.files || []);
    files.slice(0, 3 - photos.length).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => setPhotos(prev => prev.length < 3 ? [...prev, ev.target.result] : prev);
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  async function handleConfirm() {
    const errs = {};
    if (!recipientName.trim()) errs.name = "Requerido";
    if (photos.length === 0) errs.photos = "Agrega al menos 1 foto";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    await onConfirm({ photos, signature, recipientName, recipientRut, observations });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <h3 className="font-bold text-slate-800">Confirmar entrega</h3>
            <p className="text-xs text-slate-500 truncate">{stop?.label || stop?.deliveryAddress}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Photos */}
          <div>
            <label className="mb-2 block text-xs font-bold text-slate-700">
              📸 Fotos del pedido entregado *
              {errors.photos && <span className="ml-2 text-red-500">{errors.photos}</span>}
            </label>
            <div className="flex flex-wrap gap-3">
              {photos.map((src, idx) => (
                <div key={idx} className="relative group">
                  <img src={src} alt="" className="h-24 w-24 rounded-xl object-cover border border-slate-200 shadow-sm" />
                  <button type="button" onClick={() => setPhotos(p => p.filter((_, i) => i !== idx))}
                    className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow text-[10px] font-bold">
                    ✕
                  </button>
                </div>
              ))}
              {photos.length < 3 && (
                <button type="button" onClick={() => photoInputRef.current?.click()}
                  className={`flex h-24 w-24 flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
                    errors.photos ? "border-red-300 bg-red-50" : "border-slate-200 hover:border-dropit-accent/40"
                  }`}>
                  <Camera size={20} className="mb-1 text-slate-300" />
                  <span className="text-[10px] text-slate-400">Agregar</span>
                </button>
              )}
              <input ref={photoInputRef} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={handlePhotoUpload} />
            </div>
          </div>

          {/* Recipient */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                Nombre de quien recibe *
                {errors.name && <span className="ml-1 text-red-500 text-[10px]">{errors.name}</span>}
              </label>
              <input
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30 ${errors.name ? "border-red-300 bg-red-50" : "border-slate-200"}`}
                placeholder="Nombre completo"
                value={recipientName}
                onChange={e => setRecipientName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">RUT de quien recibe</label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
                placeholder="12.345.678-9"
                value={recipientRut}
                onChange={e => setRecipientRut(e.target.value)}
              />
            </div>
          </div>

          {/* Signature */}
          <div>
            <label className="mb-2 block text-xs font-bold text-slate-700">✍️ Firma del receptor</label>
            <SignaturePad onChange={setSignature} />
          </div>

          {/* Observations */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">Observaciones (opcional)</label>
            <textarea
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
              rows={2}
              placeholder="Ej: Dejado en conserjería, entregado a portero..."
              value={observations}
              onChange={e => setObservations(e.target.value)}
            />
          </div>
        </div>

        <div className="sticky bottom-0 flex gap-3 border-t border-slate-100 bg-white px-5 py-4">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50">
            {saving
              ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Guardando...</>
              : <><CheckCircle2 size={15} />Confirmar entrega</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Failure Modal ────────────────────────────────────────────────────────────
function FailureModal({ stop, onClose, onConfirm }) {
  const reasons = getFailureReasons();
  const [selected, setSelected] = useState("");
  const [custom, setCustom] = useState("");
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const photoInputRef = useRef(null);

  const finalReason = selected === reasons[reasons.length - 1] ? custom : selected;

  async function handleConfirm() {
    if (!selected) return;
    setSaving(true);
    await onConfirm({ reason: finalReason, photos });
    setSaving(false);
  }

  function handlePhotoUpload(e) {
    const files = Array.from(e.target.files || []);
    files.slice(0, 2 - photos.length).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => setPhotos(prev => prev.length < 2 ? [...prev, ev.target.result] : prev);
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-bold text-slate-800">Marcar como fallido</h3>
            <p className="text-xs text-slate-500">Selecciona el motivo del problema</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-3">
          {reasons.map(reason => (
            <label key={reason} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all ${
              selected === reason ? "border-red-300 bg-red-50" : "border-slate-200 hover:border-slate-300"
            }`}>
              <input type="radio" name="reason" value={reason} checked={selected === reason}
                onChange={() => setSelected(reason)} className="text-red-500" />
              <span className="text-sm text-slate-700">{reason}</span>
            </label>
          ))}

          {selected === reasons[reasons.length - 1] && (
            <textarea
              className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
              rows={2}
              placeholder="Describe el motivo..."
              value={custom}
              onChange={e => setCustom(e.target.value)}
            />
          )}

          {/* Evidence photos */}
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-600">Foto evidencia (opcional)</p>
            <div className="flex gap-2">
              {photos.map((src, i) => (
                <div key={i} className="relative group">
                  <img src={src} className="h-16 w-16 rounded-lg object-cover border border-slate-200" />
                  <button type="button" onClick={() => setPhotos(p => p.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[8px]">✕</button>
                </div>
              ))}
              {photos.length < 2 && (
                <button type="button" onClick={() => photoInputRef.current?.click()}
                  className="h-16 w-16 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-slate-300 hover:border-slate-400">
                  <Camera size={16} /><span className="text-[9px] mt-0.5">Foto</span>
                </button>
              )}
              <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
            </div>
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-100 px-5 py-4">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={!selected || saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-40">
            {saving
              ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />...</>
              : <><AlertCircle size={14} />Marcar fallido</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Route Detail View ────────────────────────────────────────────────────────
function RouteDetailView({ route, requests, onBack, onUpdateStop }) {
  const [deliveryModal, setDeliveryModal] = useState(null); // stop object
  const [failureModal, setFailureModal] = useState(null);
  const [routeStarted, setRouteStarted] = useState(route.status === "En ruta");
  const [stopStatuses, setStopStatuses] = useState({}); // stopId -> {status, deliveryData}
  const [navigationMode, setNavigationMode] = useState(false);

  const stops = useMemo(() => {
    return (route.orderedRequestIds || route.requestIds || [])
      .map(id => requests.find(r => r.id === id))
      .filter(Boolean);
  }, [route, requests]);

  function getStopStatus(stopId) {
    if (stopStatuses[stopId]) return stopStatuses[stopId].status;
    const req = stops.find(s => s.id === stopId);
    if (req?.status === "Entregado") return "entregado";
    if (req?.status === "En ruta") return "en_ruta";
    return "pendiente";
  }

  async function handleStartRoute() {
    try {
      await fetch(`${API_URL}/quote-requests/${stops[0]?.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "En ruta" }),
      });
    } catch {}
    setRouteStarted(true);
    if (stops[0]) {
      setStopStatuses(prev => ({ ...prev, [stops[0].id]: { status: "en_ruta" } }));
    }
  }

  async function handleDeliveryConfirm(stop, data) {
    try {
      await fetch(`${API_URL}/orders/${stop.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Entregado" }),
      });
    } catch {}
    setStopStatuses(prev => ({ ...prev, [stop.id]: { status: "entregado", deliveryData: data } }));
    setDeliveryModal(null);

    // Advance to next stop
    const idx = stops.findIndex(s => s.id === stop.id);
    if (idx < stops.length - 1) {
      const nextId = stops[idx + 1].id;
      setStopStatuses(prev => ({ ...prev, [nextId]: { status: "en_ruta" } }));
    }
    if (onUpdateStop) onUpdateStop(stop.id, "Entregado", data);
  }

  async function handleFailureConfirm(stop, data) {
    try {
      await fetch(`${API_URL}/orders/${stop.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Incidencia", incidentDescription: data.reason }),
      });
    } catch {}
    setStopStatuses(prev => ({ ...prev, [stop.id]: { status: "fallido", failureData: data } }));
    setFailureModal(null);
    if (onUpdateStop) onUpdateStop(stop.id, "Incidencia", data);
  }

  const completedCount = stops.filter(s => getStopStatus(s.id) === "entregado").length;
  const allDone = completedCount === stops.length;

  // ── Full-screen GPS navigation mode ─────────────────────────────────────────
  if (navigationMode) {
    return (
      <DriverNavigationMode
        route={route}
        stops={stops}
        onExit={() => {
          setNavigationMode(false);
          setRouteStarted(true);
        }}
        DeliveryModal={(props) => (
          <DeliveryModal {...props} onConfirm={(data) => { handleDeliveryConfirm(props.stop, data); props.onClose(); }} />
        )}
        FailureModal={(props) => (
          <FailureModal {...props} onConfirm={(data) => { handleFailureConfirm(props.stop, data); props.onClose(); }} />
        )}
      />
    );
  }

  return (
    <div className="space-y-4">
      {deliveryModal && (
        <DeliveryModal
          stop={deliveryModal}
          onClose={() => setDeliveryModal(null)}
          onConfirm={data => handleDeliveryConfirm(deliveryModal, data)}
        />
      )}
      {failureModal && (
        <FailureModal
          stop={failureModal}
          onClose={() => setFailureModal(null)}
          onConfirm={data => handleFailureConfirm(failureModal, data)}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
          <ChevronRight size={16} className="rotate-180" />
        </button>
        <div className="flex-1">
          <h3 className="font-bold text-slate-800">{route.name || route.id}</h3>
          <p className="text-xs text-slate-500">
            {route.truckName} · {route.driverName} · {stops.length} paradas · {route.plannedDate}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-dropit-accent/10 px-3 py-1 text-xs font-bold text-dropit-accent">
            {completedCount}/{stops.length} entregadas
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${stops.length > 0 ? (completedCount / stops.length) * 100 : 0}%` }} />
      </div>

      {/* Start route button */}
      <div className={`rounded-xl border p-4 ${routeStarted ? "border-dropit-accent/20 bg-dropit-accent/5" : "border-dropit-accent/30 bg-gradient-to-r from-dropit-accent/8 to-orange-50"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-800">
              {routeStarted ? "🚛 Ruta en progreso" : "¿Listo para salir?"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {routeStarted
                ? `${completedCount}/${stops.length} paradas completadas`
                : `${stops.length} paradas · GPS en tiempo real`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!routeStarted && (
              <button onClick={handleStartRoute}
                className="flex items-center gap-2 rounded-xl border border-dropit-accent/30 bg-white px-4 py-2 text-xs font-bold text-dropit-accent hover:bg-dropit-accent/5 transition-all">
                <Play size={13} />Solo marcar inicio
              </button>
            )}
            <button
              onClick={async () => {
                if (!routeStarted) await handleStartRoute();
                setNavigationMode(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-dropit-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-dropit-accent/90 shadow-md shadow-dropit-accent/30 transition-all">
              <Navigation size={15} />
              {routeStarted ? "Abrir GPS" : "🚀 Iniciar ruta GPS"}
            </button>
          </div>
        </div>
      </div>

      {/* Stop list */}
      <div className="space-y-3">
        {stops.map((stop, idx) => {
          const status = getStopStatus(stop.id);
          const isActive = status === "en_ruta" && routeStarted;
          const isDone = status === "entregado";
          const isFailed = status === "fallido";

          return (
            <div key={stop.id}
              className={`rounded-xl border p-4 transition-all ${
                isActive ? "border-dropit-accent/40 bg-dropit-accent/5 shadow-md shadow-dropit-accent/10" :
                isDone ? "border-emerald-200 bg-emerald-50" :
                isFailed ? "border-red-200 bg-red-50" :
                "border-slate-200 bg-white"
              }`}>
              <div className="flex items-start gap-3">
                {/* Stop number */}
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                  isDone ? "bg-emerald-500" : isFailed ? "bg-red-400" : isActive ? "bg-dropit-accent animate-pulse" : "bg-slate-300"
                }`}>
                  {isDone ? "✓" : isFailed ? "✕" : idx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-800">{stop.customerName}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin size={10} className="text-dropit-accent" />
                        {stop.deliveryAddress}
                      </p>
                    </div>
                    {stop.contactPhone && (
                      <a href={`tel:${stop.contactPhone}`}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:border-dropit-accent/40 hover:text-dropit-accent flex-shrink-0">
                        <Phone size={11} />{stop.contactPhone}
                      </a>
                    )}
                  </div>

                  <div className="mt-1.5 flex gap-3 text-[10px] text-slate-400">
                    <span><Package size={9} className="inline mr-0.5" />{stop.packages} bultos · {stop.estimatedWeightKg} kg</span>
                    {stop.cargoDescription && <span className="truncate max-w-[200px]">{stop.cargoDescription}</span>}
                  </div>

                  {/* Status badge */}
                  {isDone && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 size={12} />Entregado confirmado
                      {stopStatuses[stop.id]?.deliveryData?.recipientName && (
                        <span className="text-emerald-500"> · Recibió: {stopStatuses[stop.id].deliveryData.recipientName}</span>
                      )}
                    </div>
                  )}
                  {isFailed && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-600">
                      <AlertCircle size={12} />Fallido: {stopStatuses[stop.id]?.failureData?.reason}
                    </div>
                  )}

                  {/* Action buttons */}
                  {isActive && !isDone && !isFailed && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => setDeliveryModal(stop)}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600 shadow-sm">
                        <CheckCircle2 size={13} />Confirmar entrega
                      </button>
                      <button onClick={() => setFailureModal(stop)}
                        className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-100">
                        <AlertCircle size={13} />Marcar fallido
                      </button>
                    </div>
                  )}
                  {routeStarted && status === "pendiente" && idx > 0 && getStopStatus(stops[idx - 1]?.id) === "entregado" && (
                    <button onClick={() => setStopStatuses(prev => ({ ...prev, [stop.id]: { status: "en_ruta" } }))}
                      className="mt-2 flex items-center gap-1.5 rounded-lg border border-dropit-accent/30 px-3 py-1.5 text-xs font-semibold text-dropit-accent hover:bg-dropit-accent/5">
                      <Navigation size={11} />Ir a esta parada
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {allDone && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500" />
          <p className="font-bold text-emerald-800">¡Ruta completada!</p>
          <p className="text-sm text-emerald-600">{completedCount} de {stops.length} entregas exitosas</p>
        </div>
      )}
    </div>
  );
}

// ─── Route Card (list view) ───────────────────────────────────────────────────
function RouteCard({ route, requests, onOpen }) {
  const stops = (route.orderedRequestIds || route.requestIds || [])
    .map(id => requests.find(r => r.id === id)).filter(Boolean);

  const STATUS_CFG = {
    "En ruta": { label: "En ruta", dot: "bg-orange-400", badge: "bg-orange-100 text-orange-700 border-orange-200" },
    "Agendado": { label: "Agendado", dot: "bg-sky-400", badge: "bg-sky-100 text-sky-700 border-sky-200" },
    "Completada": { label: "Completada", dot: "bg-emerald-400", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    "Pendiente": { label: "Pendiente", dot: "bg-slate-300", badge: "bg-slate-100 text-slate-600 border-slate-200" },
  };
  const cfg = STATUS_CFG[route.status] || STATUS_CFG["Pendiente"];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
          <div>
            <p className="font-bold text-slate-800">{route.name || route.id}</p>
            <p className="text-xs text-slate-500">{route.plannedDate} · {route.driverName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.badge}`}>
            {cfg.label}
          </span>
          <span className="text-xs text-slate-400">{stops.length} paradas</span>
          <button onClick={() => onOpen(route)}
            className="flex items-center gap-1.5 rounded-xl bg-dropit-accent px-4 py-2 text-xs font-bold text-white hover:bg-dropit-accent/90">
            {route.status === "En ruta" ? <><Navigation size={12} />Continuar GPS</> : <><Play size={12} />Ver ruta</>}
          </button>
        </div>
      </div>

      {/* Mini stop list */}
      <div className="border-t border-slate-50 px-5 pb-3">
        <div className="mt-3 space-y-1.5">
          {stops.slice(0, 3).map((stop, i) => (
            <div key={stop.id} className="flex items-center gap-2 text-xs text-slate-500">
              <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold">{i + 1}</span>
              <span className="truncate">{stop.customerName} — {stop.deliveryAddress}</span>
              {stop.status === "Entregado" && <CheckCircle2 size={10} className="flex-shrink-0 text-emerald-500" />}
            </div>
          ))}
          {stops.length > 3 && <p className="text-[10px] text-slate-400">+{stops.length - 3} paradas más</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DriversRouteView({ currentUser, routes = [], requests = [], trucks = [] }) {
  const isSuperAdmin = ["super_admin", "admin"].includes(currentUser?.role);
  const [driverFilter, setDriverFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [activeRoute, setActiveRoute] = useState(null);

  // All unique drivers from routes
  const drivers = useMemo(() => {
    const seen = new Set();
    return routes.filter(r => r.driverName && !seen.has(r.driverName) && seen.add(r.driverName))
      .map(r => ({ name: r.driverName, phone: r.driverPhone }));
  }, [routes]);

  // All unique dates
  const dates = useMemo(() => {
    const seen = new Set();
    return routes.filter(r => r.plannedDate && !seen.has(r.plannedDate) && seen.add(r.plannedDate))
      .map(r => r.plannedDate).sort().reverse();
  }, [routes]);

  const filtered = useMemo(() => {
    return routes.filter(r => {
      const matchDriver = driverFilter === "all" || r.driverName === driverFilter;
      const matchDate = dateFilter === "all" || r.plannedDate === dateFilter;
      // Conductors see only their own routes
      if (!isSuperAdmin) {
        return r.driverName === currentUser?.name && matchDate;
      }
      return matchDriver && matchDate;
    });
  }, [routes, driverFilter, dateFilter, isSuperAdmin, currentUser]);

  const enRuta = filtered.filter(r => r.status === "En ruta").length;
  const completadas = filtered.filter(r => r.status === "Completada").length;
  const pendientes = filtered.filter(r => !["En ruta", "Completada"].includes(r.status)).length;

  if (activeRoute) {
    return (
      <RouteDetailView
        route={activeRoute}
        requests={requests}
        onBack={() => setActiveRoute(null)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-dropit-accent">Logística</p>
        <h2 className="text-2xl font-black text-slate-800">Rutas de conductores</h2>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "En ruta", val: enRuta, color: "text-orange-500", bg: "bg-orange-50 border-orange-100" },
          { label: "Completadas", val: completadas, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
          { label: "Pendientes", val: pendientes, color: "text-slate-500", bg: "bg-slate-50 border-slate-200" },
        ].map(({ label, val, color, bg }) => (
          <div key={label} className={`rounded-xl border p-4 ${bg}`}>
            <p className={`text-3xl font-black ${color}`}>{val}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      {isSuperAdmin && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <User size={14} className="text-slate-400" />
            <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
              value={driverFilter} onChange={e => setDriverFilter(e.target.value)}>
              <option value="all">Todos los conductores</option>
              {drivers.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-slate-400" />
            <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
              value={dateFilter} onChange={e => setDateFilter(e.target.value)}>
              <option value="all">Todas las fechas</option>
              {dates.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Route list */}
      {filtered.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white">
          <Truck size={28} className="mb-3 text-slate-300" />
          <p className="text-sm font-bold text-slate-500">Sin rutas para los filtros seleccionados</p>
          <p className="text-xs text-slate-400 mt-1">Las rutas aparecen aquí al planificarlas en el módulo de Rutas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(route => (
            <RouteCard key={route.id} route={route} requests={requests} onOpen={setActiveRoute} />
          ))}
        </div>
      )}
    </div>
  );
}
