import {
  AlertCircle, ArrowDown, ArrowUp, CheckCircle2, ChevronDown,
  ChevronRight, Eye, MapPin, Navigation, Package, Plus, Route,
  Search, Sparkles, Truck, X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import LeafletMap, { getCoordsByCommune, haversine, optimizeRoute } from "./LeafletMap";
import StatusBadge from "./StatusBadge";

// ─── 2-opt ────────────────────────────────────────────────────────────────────
function twoOptImprove(locations) {
  if (!locations || locations.length <= 3) return locations;
  let route = [...locations];
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < route.length - 1; i++) {
      for (let j = i + 1; j < route.length; j++) {
        if (!route[i - 1]?.coords || !route[i]?.coords || !route[j]?.coords) continue;
        const next = route[(j + 1) % route.length];
        if (!next?.coords) continue;
        const before = haversine(route[i - 1].coords, route[i].coords) + haversine(route[j].coords, next.coords);
        const after = haversine(route[i - 1].coords, route[j].coords) + haversine(route[i].coords, next.coords);
        if (after < before - 0.01) {
          route = [...route.slice(0, i), ...route.slice(i, j + 1).reverse(), ...route.slice(j + 1)];
          improved = true;
        }
      }
    }
  }
  return route;
}

function getTrafficInfo() {
  const h = new Date().getHours();
  if ((h >= 7 && h <= 9) || (h >= 18 && h <= 20)) return { label: "Congestión alta", color: "text-red-500" };
  if ((h >= 10 && h <= 12) || (h >= 15 && h <= 17)) return { label: "Tráfico moderado", color: "text-amber-500" };
  return { label: "Tráfico fluido", color: "text-emerald-500" };
}

// ─── Geocoding (module-level cache + Nominatim) ───────────────────────────────
const GEO_CACHE = new Map();
const ORIGIN = [-33.4568, -70.5987]; // Ñuñoa base

async function geocodeAddr(address) {
  if (!address) return null;
  const key = address.toLowerCase().trim();
  if (GEO_CACHE.has(key)) return GEO_CACHE.get(key);

  const simplified = address
    .replace(/^(avenida|av\.|calle|pasaje|pje\.|camino|ruta|sector|villa|población)\s+/i, "")
    .trim();

  for (const q of [address + ", Santiago, Chile", simplified + ", Chile"]) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=cl&limit=5&addressdetails=1`,
        { headers: { "User-Agent": "dropit-tms/1.0" }, signal: AbortSignal.timeout(6000) }
      );
      const data = await res.json();
      if (data[0]) {
        const coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        GEO_CACHE.set(key, coords);
        return coords;
      }
    } catch { /* next variant */ }
  }

  const fb = getCoordsByCommune(address);
  if (fb) GEO_CACHE.set(key, fb);
  return fb;
}

// Hook: geocode array of {id, address} items
function useGeocodedCoords(items) {
  const [coordsMap, setCoordsMap] = useState(() => {
    const m = new Map();
    items.forEach(i => {
      const c = GEO_CACHE.get(i.address?.toLowerCase().trim()) || getCoordsByCommune(i.address);
      if (c) m.set(i.id, c);
    });
    return m;
  });
  const [geocoding, setGeocoding] = useState(false);
  const prevKey = useRef("");
  const idsKey = items.map(i => i.id).sort().join(",");

  useEffect(() => {
    if (idsKey === prevKey.current) return;
    prevKey.current = idsKey;

    // Set cached immediately
    setCoordsMap(prev => {
      const next = new Map(prev);
      items.forEach(i => {
        if (!next.has(i.id)) {
          const c = GEO_CACHE.get(i.address?.toLowerCase().trim()) || getCoordsByCommune(i.address);
          if (c) next.set(i.id, c);
        }
      });
      return next;
    });

    const toGeo = items.filter(i => !GEO_CACHE.has(i.address?.toLowerCase().trim()));
    if (!toGeo.length) return;
    setGeocoding(true);
    let cancelled = false;

    (async () => {
      for (let idx = 0; idx < toGeo.length; idx++) {
        if (cancelled) break;
        const item = toGeo[idx];
        const coords = await geocodeAddr(item.address);
        if (!cancelled && coords) setCoordsMap(prev => new Map(prev).set(item.id, coords));
        if (idx < toGeo.length - 1 && !cancelled) await new Promise(r => setTimeout(r, 350));
      }
      if (!cancelled) setGeocoding(false);
    })();

    return () => { cancelled = true; };
  }, [idsKey]);

  return { coordsMap, geocoding };
}

// ─── Address autocomplete ──────────────────────────────────────────────────────
function AddressSearch({ value, onChange, onSelect, placeholder, error }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);

  async function search(q) {
    if (!q || q.length < 4) { setSuggestions([]); return; }
    setLoading(true);
    try {
      const simplified = q.replace(/^(avenida|av\.|calle|pasaje|pje\.|camino|sector)\s+/i, "").trim();
      const base = "https://nominatim.openstreetmap.org/search?format=json&countrycodes=cl&limit=7&addressdetails=1";
      let res = await fetch(`${base}&q=${encodeURIComponent(q + ", Chile")}`, {
        headers: { "User-Agent": "dropit-tms/1.0" }, signal: AbortSignal.timeout(5000),
      });
      let data = await res.json();
      if (data.length < 3 && simplified !== q) {
        const res2 = await fetch(`${base}&q=${encodeURIComponent(simplified + ", Santiago, Chile")}`, {
          headers: { "User-Agent": "dropit-tms/1.0" }, signal: AbortSignal.timeout(5000),
        });
        const data2 = await res2.json();
        if (data2.length > data.length) data = data2;
      }
      setSuggestions(data.slice(0, 7));
    } catch {}
    setLoading(false);
  }

  function handleInput(val) {
    onChange(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => search(val), 450);
  }

  function handleSelect(item) {
    const label = item.display_name.split(",").slice(0, 3).join(",").trim();
    onChange(label);
    onSelect({ address: label, coords: [parseFloat(item.lat), parseFloat(item.lon)], raw: item });
    setSuggestions([]);
  }

  return (
    <div className="relative">
      <input
        type="text"
        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30 ${error ? "border-red-300 bg-red-50" : "border-slate-200"}`}
        placeholder={placeholder}
        value={value}
        onChange={e => handleInput(e.target.value)}
        autoComplete="off"
      />
      {loading && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 animate-pulse">Buscando...</div>}
      {suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          {suggestions.map((s, i) => {
            const parts = s.display_name.split(",");
            return (
              <li key={i} onMouseDown={() => handleSelect(s)}
                className="flex cursor-pointer gap-2 border-b border-slate-50 px-3 py-2.5 text-xs last:border-0 hover:bg-dropit-accent/5">
                <MapPin size={12} className="mt-0.5 flex-shrink-0 text-dropit-accent" />
                <div>
                  <p className="font-semibold text-slate-800">{parts[0]}</p>
                  <p className="text-slate-400 truncate">{parts.slice(1, 4).join(",")}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Add Order Modal ──────────────────────────────────────────────────────────
const inputCls = (err) =>
  `w-full rounded-lg border ${err ? "border-red-300 bg-red-50" : "border-slate-200"} px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30`;

function Field({ label, error, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</label>
      {children}
      {error && <p className="mt-1 text-[10px] text-red-600">{error}</p>}
    </div>
  );
}

function AddOrderModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    customerName: "", contactPerson: "", contactPhone: "", contactEmail: "",
    pickupAddress: "Av. Irarrazaval 2401, Ñuñoa, Santiago",
    deliveryAddress: "", destinationCity: "",
    packages: 1, estimatedWeightKg: 10, cargoDescription: "",
    requiredDate: new Date().toISOString().slice(0, 10),
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  async function handleSave() {
    const errs = {};
    if (!form.customerName.trim()) errs.customerName = "Requerido";
    if (!form.contactEmail.trim()) errs.contactEmail = "Requerido";
    if (!form.deliveryAddress.trim()) errs.deliveryAddress = "Requerido";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      const result = await api.createQuoteRequest({
        ...form,
        contactPerson: form.contactPerson || form.customerName,
        packages: Number(form.packages),
        estimatedWeightKg: Number(form.estimatedWeightKg),
      });
      onSave(result.request || result);
    } catch (e) {
      setErrors({ general: e.message || "Error al crear el pedido" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <div>
            <h3 className="font-bold text-slate-800">Agregar pedido manualmente</h3>
            <p className="text-xs text-slate-500">Completa los datos — el pedido quedará listo para planificar</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>

        <div className="p-6 space-y-4">
          {errors.general && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle size={14} />{errors.general}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Empresa / Cliente *" error={errors.customerName}>
              <input className={inputCls(errors.customerName)} value={form.customerName}
                onChange={e => set("customerName", e.target.value)} placeholder="Ej: Comercial Los Aromos" />
            </Field>
            <Field label="Persona de contacto">
              <input className={inputCls()} value={form.contactPerson}
                onChange={e => set("contactPerson", e.target.value)} placeholder="Nombre" />
            </Field>
            <Field label="Teléfono">
              <input className={inputCls()} value={form.contactPhone}
                onChange={e => set("contactPhone", e.target.value)} placeholder="+56 9 xxxx xxxx" />
            </Field>
            <Field label="Email *" error={errors.contactEmail}>
              <input type="email" className={inputCls(errors.contactEmail)} value={form.contactEmail}
                onChange={e => set("contactEmail", e.target.value)} placeholder="correo@empresa.cl" />
            </Field>
          </div>

          <Field label="📍 Dirección de retiro">
            <AddressSearch value={form.pickupAddress}
              onChange={v => set("pickupAddress", v)}
              onSelect={({ address }) => set("pickupAddress", address)}
              placeholder="Buscar dirección de origen..." />
          </Field>

          <Field label="📍 Dirección de entrega *" error={errors.deliveryAddress}>
            <AddressSearch value={form.deliveryAddress} error={errors.deliveryAddress}
              onChange={v => set("deliveryAddress", v)}
              onSelect={({ address, raw }) => {
                set("deliveryAddress", address);
                const commune = raw?.address?.city_district || raw?.address?.suburb || raw?.address?.city || "";
                if (commune) set("destinationCity", commune);
              }}
              placeholder="Ej: Av. Pdte. Frei Montalva 9770, Quilicura..." />
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Bultos">
              <input type="number" min="1" max="999" className={inputCls()} value={form.packages}
                onChange={e => set("packages", e.target.value)} />
            </Field>
            <Field label="Peso estimado (kg)">
              <input type="number" min="1" className={inputCls()} value={form.estimatedWeightKg}
                onChange={e => set("estimatedWeightKg", e.target.value)} />
            </Field>
            <Field label="Fecha requerida">
              <input type="date" className={inputCls()} value={form.requiredDate}
                onChange={e => set("requiredDate", e.target.value)} />
            </Field>
          </div>

          <Field label="Descripción de la carga">
            <textarea className={inputCls() + " resize-none"} rows={2}
              value={form.cargoDescription}
              onChange={e => set("cargoDescription", e.target.value)}
              placeholder="Ej: Cajas selladas de productos electrónicos" />
          </Field>
        </div>

        <div className="sticky bottom-0 flex gap-3 border-t border-slate-100 bg-white px-6 py-4">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-dropit-accent py-2.5 text-sm font-bold text-white hover:bg-dropit-accent/90 disabled:opacity-50">
            {saving
              ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Guardando...</>
              : <><Package size={15} />Agregar pedido</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepIndicator({ step }) {
  const steps = ["1. Vehículos", "2. Visitas", "3. Rutas"];
  return (
    <div className="flex items-center gap-0 rounded-lg overflow-hidden border border-slate-200">
      {steps.map((label, idx) => {
        const num = idx + 1;
        const active = step === num;
        const done = step > num;
        return (
          <div key={label} className={`flex flex-1 items-center justify-center gap-2 py-2.5 px-3 text-sm font-semibold transition-colors ${
            active ? "bg-dropit-accent text-white" : done ? "bg-dropit-accent/20 text-dropit-accent" : "bg-slate-50 text-slate-400"
          } ${idx < steps.length - 1 ? "border-r border-white/20" : ""}`}>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-black ${
              active ? "bg-white/20" : done ? "bg-dropit-accent text-white" : "bg-slate-200 text-slate-500"
            }`}>
              {done ? <CheckCircle2 size={12} /> : num}
            </span>
            <span className="hidden sm:block">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Route detail modal ───────────────────────────────────────────────────────
function RouteDetailModal({ route, requests, onClose }) {
  const routeRequests = (route.orderedRequestIds || route.requestIds || [])
    .map(id => requests.find(r => r.id === id)).filter(Boolean);

  const geoItems = routeRequests.map(r => ({ id: r.id, address: r.deliveryAddress || r.destinationCity }));
  const { coordsMap } = useGeocodedCoords(geoItems);

  const markers = useMemo(() => {
    const pts = [{ coords: ORIGIN, label: "Origen: Ñuñoa", status: "base", popup: "🚛 Origen: Ñuñoa" }];
    routeRequests.forEach((req, i) => {
      const coords = coordsMap.get(req.id);
      if (coords) pts.push({ coords, label: req.customerName, status: "pendiente", popup: `📦 ${i + 1}. ${req.customerName}<br/>${req.deliveryAddress}` });
    });
    return pts;
  }, [routeRequests, coordsMap]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-800">{route.name || route.id}</h3>
            <p className="text-xs text-slate-500">{route.truckName} · {route.driverName} · {routeRequests.length} paradas</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="grid flex-1 overflow-hidden lg:grid-cols-[1fr_280px]">
          <div className="relative">
            <LeafletMap markers={markers} polyline={markers.map(m => m.coords)} routing dark={false} height="100%" fitBounds />
          </div>
          <div className="overflow-y-auto border-l border-slate-100 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Secuencia de entrega</p>
            <div className="space-y-2">
              {routeRequests.map((req, idx) => (
                <div key={req.id} className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-dropit-accent text-[10px] font-bold text-white">{idx + 1}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{req.customerName}</p>
                    <p className="text-[10px] text-slate-400 truncate">{req.deliveryAddress}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 text-xs text-slate-500">
              <div className="flex justify-between"><span>Estado</span><span className={`font-bold ${route.status === "En ruta" ? "text-orange-600" : "text-sky-600"}`}>{route.status}</span></div>
              <div className="flex justify-between"><span>Fecha</span><span className="font-medium text-slate-700">{route.plannedDate || "—"}</span></div>
              <div className="flex justify-between"><span>Vehículo</span><span className="font-medium text-slate-700">{route.truckName || "—"}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Routes list view ─────────────────────────────────────────────────────────
const ROUTE_COLORS = ["#F97316", "#3b82f6", "#a855f7", "#10b981", "#ec4899", "#f59e0b", "#14b8a6", "#ef4444"];

function RoutesListView({ routes, requests, onBack }) {
  const [expandedId, setExpandedId] = useState(routes[0]?.id || null);
  const [detailRoute, setDetailRoute] = useState(null);

  const geoItems = useMemo(() =>
    requests.map(r => ({ id: r.id, address: r.deliveryAddress || r.destinationCity })),
    [requests.map(r => r.id).join(",")]
  );
  const { coordsMap } = useGeocodedCoords(geoItems);

  const routesWithMeta = useMemo(() => routes.map((route, idx) => {
    const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
    const stops = (route.orderedRequestIds || route.requestIds || [])
      .map(id => requests.find(r => r.id === id)).filter(Boolean);

    const stopMarkers = stops.map((req, si) => {
      const coords = coordsMap.get(req.id) || getCoordsByCommune(req.deliveryAddress) || getCoordsByCommune(req.destinationCity);
      return coords ? { coords, label: req.customerName, popup: `<b>${si + 1}. ${req.customerName}</b><br/>${req.deliveryAddress}` } : null;
    }).filter(Boolean);

    const waypoints = [ORIGIN, ...stopMarkers.map(m => m.coords)];
    const allMarkers = [
      { coords: ORIGIN, label: "Bodega origen", popup: `<b>🏭 Bodega origen</b><br/>${route.truckName || ""}` },
      ...stopMarkers,
    ];

    let distKm = 0;
    const pts = [...waypoints, ORIGIN];
    for (let i = 0; i < pts.length - 1; i++) {
      distKm += haversine(pts[i], pts[i + 1]);
    }

    return { ...route, color, stops, allMarkers, waypoints, distKm: Math.round(distKm * 10) / 10 };
  }), [routes, requests, coordsMap]);

  const multiRoutes = routesWithMeta.map(r => ({
    waypoints: r.waypoints, color: r.color, markers: r.allMarkers, label: r.name || r.id,
  }));

  const totalStops = routesWithMeta.reduce((s, r) => s + r.stops.length, 0);
  const totalKm = routesWithMeta.reduce((s, r) => s + r.distKm, 0).toFixed(1);

  return (
    <div className="flex flex-col gap-0" style={{ height: "calc(100vh - 120px)", minHeight: 500 }}>
      {detailRoute && <RouteDetailModal route={detailRoute} requests={requests} onClose={() => setDetailRoute(null)} />}

      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-dropit-accent">Resultado</p>
          <h2 className="text-xl font-black text-slate-800">Rutas optimizadas</h2>
        </div>
        <div className="flex items-center gap-3">
          {[
            { icon: Truck, label: "Vehículos", val: routes.length },
            { icon: Package, label: "Paradas", val: totalStops },
            { icon: Route, label: "Distancia est.", val: `${totalKm} km` },
          ].map(({ icon: Icon, label, val }) => (
            <div key={label} className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs">
              <Icon size={13} className="text-dropit-accent" />
              <span className="text-slate-500">{label}</span>
              <span className="font-bold text-slate-800">{val}</span>
            </div>
          ))}
          <button onClick={onBack}
            className="flex items-center gap-1.5 rounded-xl bg-dropit-accent px-4 py-2 text-sm font-bold text-white hover:bg-dropit-accent/90 shadow-sm">
            <Plus size={14} />Nueva planificación
          </button>
        </div>
      </div>

      {routes.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white">
          <Route size={28} className="mb-2 text-slate-300" />
          <p className="text-sm font-bold text-slate-400">No hay rutas creadas</p>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="w-[300px] flex-shrink-0 overflow-y-auto border-r border-slate-100 p-3 space-y-2">
            {routesWithMeta.map((route) => {
              const expanded = expandedId === route.id;
              const statusColor = route.status === "En ruta" ? "bg-orange-100 text-orange-700" : "bg-sky-100 text-sky-700";
              return (
                <div key={route.id} className={`rounded-xl border transition-all ${expanded ? "border-slate-300 shadow-sm" : "border-slate-100"}`}>
                  <button type="button" onClick={() => setExpandedId(expanded ? null : route.id)}
                    className="flex w-full items-center gap-2.5 px-3 py-3 text-left">
                    <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: route.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{route.name || route.id}</p>
                      <p className="text-[10px] text-slate-500 truncate">{route.truckName || "—"} · {route.driverName || "—"}</p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${statusColor}`}>{route.status}</span>
                      <span className="text-[9px] text-slate-400">{route.stops.length} paradas · {route.distKm} km</span>
                    </div>
                    <ChevronDown size={13} className={`flex-shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
                  </button>

                  {expanded && (
                    <div className="border-t border-slate-100 px-3 pb-3 pt-2 space-y-1.5">
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <div className="h-2 w-2 rounded-full bg-slate-400 flex-shrink-0" />
                        <span className="font-semibold">Bodega origen</span>
                      </div>
                      {route.stops.map((req, si) => (
                        <div key={req.id} className="flex items-start gap-2">
                          <div className="flex flex-col items-center mt-0.5">
                            <div className="h-4 w-4 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] font-black text-white" style={{ background: route.color }}>
                              {si + 1}
                            </div>
                            {si < route.stops.length - 1 && <div className="w-px flex-1 bg-slate-200 my-0.5" style={{ minHeight: 8 }} />}
                          </div>
                          <div className="min-w-0 pb-1">
                            <p className="text-[10px] font-semibold text-slate-800 truncate">{req.customerName}</p>
                            <p className="text-[9px] text-slate-400 truncate">{req.deliveryAddress}</p>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-1">
                        <div className="h-2 w-2 rounded-full bg-slate-300 flex-shrink-0" />
                        <span>↩ Retorno a bodega</span>
                      </div>
                      <button onClick={() => setDetailRoute(route)}
                        className="mt-2 w-full rounded-lg border border-dropit-accent/30 py-1.5 text-[10px] font-bold text-dropit-accent hover:bg-dropit-accent/5">
                        Ver detalle
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex-1 min-w-0">
            <LeafletMap multiRoutes={multiRoutes} routing closedLoop dark={false} height="100%" fitBounds center={ORIGIN} zoom={11} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 1: Vehicles ─────────────────────────────────────────────────────────
function Step1Vehicles({ trucks, selectedTruck, onSelectTruck, form, onFormChange, onNext }) {
  const today = new Date().toISOString().slice(0, 10);
  const demoMarkers = [
    { coords: ORIGIN, label: "Base: Ñuñoa", status: "base", popup: "🚛 Origen: Ñuñoa" },
    { coords: [-33.4163, -70.5831], label: "Las Condes", status: "pendiente", popup: "📦 Zona Las Condes" },
    { coords: [-33.5103, -70.7634], label: "Maipú", status: "pendiente", popup: "📦 Zona Maipú" },
    { coords: [-33.5261, -70.6586], label: "La Cisterna", status: "pendiente", popup: "📦 Zona La Cisterna" },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Información inicial</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Fecha inicio", key: "startDate", type: "date", default: today },
              { label: "Hora inicio", key: "startTime", type: "time", default: "09:00" },
              { label: "Fecha término", key: "endDate", type: "date", default: today },
              { label: "Hora término", key: "endTime", type: "time", default: "17:00" },
            ].map(({ label, key, type, default: def }) => (
              <div key={key}>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</label>
                <input type={type} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
                  value={form[key] || def} onChange={e => onFormChange(key, e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Selecciona los vehículos</h3>
          {trucks.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No hay vehículos registrados</p>
          ) : (
            <table className="w-full text-xs">
              <thead><tr className="border-b border-slate-100">
                <th className="w-8 pb-2"></th>
                <th className="pb-2 text-left font-bold uppercase tracking-wider text-slate-500">Vehículo</th>
                <th className="pb-2 text-left font-bold uppercase tracking-wider text-slate-500">Conductor</th>
                <th className="pb-2 text-left font-bold uppercase tracking-wider text-slate-500">Capac. kg</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {trucks.map((truck) => {
                  const sel = selectedTruck?.id === truck.id;
                  const avail = truck.status === "Disponible";
                  return (
                    <tr key={truck.id} className={`cursor-pointer transition-colors ${sel ? "bg-dropit-accent/5" : "hover:bg-slate-50"}`}
                      onClick={() => onSelectTruck(sel ? null : truck)}>
                      <td className="py-2"><input type="checkbox" className="rounded border-slate-300 text-dropit-accent" checked={sel} readOnly /></td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${avail ? "bg-emerald-400" : "bg-slate-300"}`} />
                          <span className="font-semibold text-slate-800">{truck.name || truck.plate}</span>
                        </div>
                      </td>
                      <td className="py-2 text-slate-600">{truck.driverName || "—"}</td>
                      <td className="py-2 text-slate-600">{truck.maxWeightKg?.toLocaleString() || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="hidden lg:flex flex-col gap-2">
        <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 shadow-sm" style={{ minHeight: "420px" }}>
          <LeafletMap markers={demoMarkers} polyline={demoMarkers.map(m => m.coords)} dark={false} height="100%" zoom={11} />
        </div>
        <p className="text-center text-xs text-slate-400">Cobertura operacional · Santiago y regiones</p>
      </div>

      <div className="lg:col-span-2">
        <button onClick={onNext} disabled={!selectedTruck}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-dropit-accent py-3 text-sm font-bold text-white shadow-md hover:bg-dropit-accent/90 disabled:opacity-40 disabled:cursor-not-allowed">
          Guardar y continuar <ChevronRight size={16} />
        </button>
        {!selectedTruck && <p className="mt-2 text-center text-xs text-slate-400">Selecciona al menos un vehículo para continuar</p>}
      </div>
    </div>
  );
}

// ─── Step 2: Visits ───────────────────────────────────────────────────────────
function Step2Visits({ requests, selectedIds, onToggle, onReorder, onNext, onBack, onAddRequest }) {
  const [search, setSearch] = useState("");
  const [autoOptimized, setAutoOptimized] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const traffic = getTrafficInfo();
  const prevLen = useRef(0);

  const candidates = useMemo(() => requests.filter(r => {
    const allowed = ["Aceptado por cliente", "Cotizado", "Agendado", "Pendiente de cotizacion"].includes(r.status);
    const match = !search || [r.customerName, r.deliveryAddress, r.id].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    return allowed && match;
  }), [requests, search]);

  const geoItems = useMemo(() =>
    candidates.map(r => ({ id: r.id, address: r.deliveryAddress || r.destinationCity })),
    [candidates.map(r => r.id).join(",")]
  );
  const { coordsMap, geocoding } = useGeocodedCoords(geoItems);

  const markers = useMemo(() => {
    const pts = [{ coords: ORIGIN, label: "Bodega origen", status: "base", popup: "🚛 <b>Bodega origen</b><br/>Ñuñoa, Santiago" }];
    candidates.filter(r => selectedIds.includes(r.id)).forEach((req, i) => {
      const coords = coordsMap.get(req.id);
      if (coords) pts.push({
        coords, label: req.customerName, status: "pendiente",
        popup: `<b>📦 ${i + 1}. ${req.customerName}</b><br/>${req.deliveryAddress}<br/><span style="color:#6b7280;font-size:11px">${req.packages} bultos · ${req.estimatedWeightKg} kg</span>`,
      });
    });
    return pts;
  }, [candidates, selectedIds, coordsMap]);

  const today = new Date().toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });

  useEffect(() => {
    if (selectedIds.length >= 2 && selectedIds.length > prevLen.current) {
      const locs = markers.map((m, i) => ({ ...m, origIdx: i }));
      if (locs.length >= 2) {
        const nn = optimizeRoute(locs);
        const improved = twoOptImprove(nn);
        const selectedReqs = candidates.filter(r => selectedIds.includes(r.id));
        const newOrder = improved.slice(1).map(loc => selectedReqs[loc.origIdx - 1]?.id).filter(Boolean);
        if (newOrder.length === selectedIds.length) { onReorder(newOrder); setAutoOptimized(true); }
      }
    }
    if (selectedIds.length === 0) setAutoOptimized(false);
    prevLen.current = selectedIds.length;
  }, [selectedIds.length]);

  return (
    <>
      {showModal && (
        <AddOrderModal
          onClose={() => setShowModal(false)}
          onSave={req => { onAddRequest(req); setShowModal(false); }}
        />
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`flex items-center gap-1 text-xs font-semibold ${traffic.color}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />{traffic.label}
            </span>
            <span className="text-xs text-slate-500">Fecha: <b>{today}</b></span>
            {geocoding && <span className="text-xs text-dropit-accent animate-pulse">Geocodificando direcciones...</span>}
            {autoOptimized && <span className="text-xs font-medium text-emerald-600">✓ Ruta auto-optimizada</span>}
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-dropit-accent px-3 py-2 text-xs font-bold text-white hover:bg-dropit-accent/90 shadow-sm">
            <Plus size={13} />Agregar pedido
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_500px]">
          {/* Order list */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-700">Visitas disponibles</h3>
              <span className="text-xs font-semibold text-dropit-accent">{selectedIds.length}/{candidates.length} seleccionada{selectedIds.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
                  placeholder="Buscar por ID, cliente o dirección..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="divide-y divide-slate-50 overflow-y-auto" style={{ maxHeight: "460px" }}>
              {candidates.length === 0 ? (
                <div className="py-12 text-center">
                  <Package size={24} className="mx-auto mb-2 text-slate-300" />
                  <p className="text-sm text-slate-400">No hay pedidos disponibles</p>
                  <button onClick={() => setShowModal(true)} className="mt-3 text-xs font-semibold text-dropit-accent hover:underline">
                    + Agregar pedido manualmente
                  </button>
                </div>
              ) : candidates.map(req => {
                const checked = selectedIds.includes(req.id);
                const hasCoords = coordsMap.has(req.id);
                return (
                  <label key={req.id} className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors ${checked ? "bg-dropit-accent/5" : "hover:bg-slate-50"}`}>
                    <input type="checkbox" className="mt-1 rounded border-slate-300 text-dropit-accent" checked={checked} onChange={() => onToggle(req.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-bold text-slate-800 truncate">{req.id} — {req.customerName}</p>
                        <StatusBadge status={req.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 truncate">
                        {hasCoords ? "📍" : "⌛"} {req.deliveryAddress}
                      </p>
                      <div className="mt-1 flex gap-3 text-[10px] text-slate-400">
                        <span className="flex items-center gap-1"><Package size={10} />{req.packages} bultos</span>
                        <span>{req.estimatedWeightKg} kg</span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Big interactive map */}
          <div className="flex flex-col gap-2">
            <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm" style={{ height: "540px" }}>
              <LeafletMap
                markers={markers}
                polyline={markers.map(m => m.coords)}
                routing={markers.length > 1}
                dark={false}
                height="100%"
                fitBounds={markers.length > 1}
              />
            </div>
            {selectedIds.length > 0 && (
              <p className="text-center text-xs font-medium text-dropit-accent">
                {selectedIds.length} parada{selectedIds.length !== 1 ? "s" : ""} seleccionada{selectedIds.length !== 1 ? "s" : ""} · {geocoding ? "calculando rutas..." : "ruta trazada ✓"}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onBack} className="rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">← Anterior</button>
          <button onClick={onNext} disabled={selectedIds.length === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-dropit-accent py-2.5 text-sm font-bold text-white hover:bg-dropit-accent/90 disabled:opacity-40 disabled:cursor-not-allowed">
            Crear rutas <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Step 3: Routes ───────────────────────────────────────────────────────────
function Step3Routes({ requests, selectedIds, selectedTruck, form, onFormChange, onReorder, onBack, onSubmit, loading, routes }) {
  const [optimized, setOptimized] = useState(false);
  const traffic = getTrafficInfo();

  const selectedRequests = useMemo(() =>
    selectedIds.map(id => requests.find(r => r.id === id)).filter(Boolean),
    [selectedIds, requests]
  );

  const geoItems = useMemo(() =>
    selectedRequests.map(r => ({ id: r.id, address: r.deliveryAddress || r.destinationCity })),
    [selectedRequests.map(r => r.id).join(",")]
  );
  const { coordsMap, geocoding } = useGeocodedCoords(geoItems);

  const markers = useMemo(() => {
    const pts = [{ coords: ORIGIN, label: "Bodega origen", status: "base", popup: "🚛 <b>Bodega origen</b><br/>Ñuñoa, Santiago" }];
    selectedRequests.forEach((req, i) => {
      const coords = coordsMap.get(req.id);
      if (coords) pts.push({ coords, label: req.customerName, status: "en_ruta", popup: `<b>📦 ${i + 1}. ${req.customerName}</b><br/>${req.deliveryAddress}` });
    });
    return pts;
  }, [selectedRequests, coordsMap]);

  function handleOptimize() {
    const locs = markers.map((m, i) => ({ ...m, origIdx: i }));
    const nn = optimizeRoute(locs);
    const improved = twoOptImprove(nn);
    const newOrder = improved.slice(1).map(loc => selectedRequests[loc.origIdx - 1]?.id).filter(Boolean);
    onReorder(newOrder);
    setOptimized(true);
  }

  function move(index, dir) {
    const next = [...selectedIds];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onReorder(next);
    setOptimized(false);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        {/* Big interactive map */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 shadow-sm" style={{ height: "540px" }}>
          {geocoding && (
            <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-dropit-accent shadow-sm">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-dropit-accent/30 border-t-dropit-accent" />
              Calculando rutas reales...
            </div>
          )}
          <LeafletMap markers={markers} polyline={markers.map(m => m.coords)} routing dark={false} height="100%" fitBounds />
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleOptimize}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-bold transition-all ${
              optimized ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-dropit-accent/40 bg-dropit-accent/5 text-dropit-accent hover:bg-dropit-accent/10"
            }`}>
            {optimized ? <><CheckCircle2 size={15} />Optimizado (NN + 2-opt)</> : <><Sparkles size={15} />Optimizar ruta (NN + 2-opt)</>}
          </button>
          <span className={`flex items-center gap-1 rounded-lg border px-3 py-2.5 text-xs font-semibold whitespace-nowrap ${traffic.color}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />{traffic.label}
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-700">Secuencia de paradas</h3>
            <span className="text-xs font-medium text-dropit-accent">{selectedRequests.length} paradas</span>
          </div>
          <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
            {selectedRequests.map((req, idx) => (
              <div key={req.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-dropit-accent text-[10px] font-bold text-white">{idx + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-800 truncate">{req.customerName}</p>
                  <p className="text-[10px] text-slate-400 truncate">{req.deliveryAddress}</p>
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} className="rounded p-1 text-slate-400 hover:bg-slate-200 disabled:opacity-30"><ArrowUp size={12} /></button>
                  <button type="button" onClick={() => move(idx, 1)} disabled={idx === selectedRequests.length - 1} className="rounded p-1 text-slate-400 hover:bg-slate-200 disabled:opacity-30"><ArrowDown size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Configuración de ruta</h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Nombre de ruta</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
                placeholder="Ej: Ruta 1 — Las Condes" value={form.name} onChange={e => onFormChange("name", e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Vehículo</label>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 bg-slate-50">
                <Truck size={14} className="text-dropit-accent" />
                <span className="text-sm font-medium text-slate-700">{selectedTruck?.name || "—"}</span>
              </div>
            </div>
            {selectedTruck?.driverName && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Conductor</label>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 bg-slate-50">
                  <Navigation size={14} className="text-slate-400" />
                  <span className="text-sm text-slate-600">{selectedTruck.driverName}</span>
                </div>
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Fecha del plan</label>
              <input type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
                value={form.startDate} onChange={e => onFormChange("startDate", e.target.value)} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded border-slate-300 text-dropit-accent"
                checked={form.startRoute} onChange={e => onFormChange("startRoute", e.target.checked)} />
              <span className="text-sm text-slate-700">Cambiar pedidos a "En ruta"</span>
            </label>
          </div>
        </div>

        {routes.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 mb-3">Rutas creadas ({routes.length})</h3>
            <div className="space-y-2">
              {routes.slice(-3).map(route => (
                <div key={route.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-bold text-slate-800">{route.name || route.id}</p>
                  <p className="text-[10px] text-slate-500">{route.truckName} · {route.requestIds?.length} paradas</p>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${route.status === "En ruta" ? "bg-orange-100 text-orange-700" : "bg-sky-100 text-sky-700"}`}>{route.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onBack} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">← Anterior</button>
          <button onClick={onSubmit} disabled={loading || !form.name || selectedIds.length === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-dropit-accent py-2.5 text-sm font-bold text-white hover:bg-dropit-accent/90 disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Creando...</> : <><Route size={16} />Crear ruta</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────
export default function RoutePlanningModule({ requests, trucks, routes, onCreateRoute }) {
  const [view, setView] = useState("wizard");
  const [step, setStep] = useState(1);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [extraRequests, setExtraRequests] = useState([]);
  const [form, setForm] = useState({
    name: "", startDate: new Date().toISOString().slice(0, 10),
    startTime: "09:00", endDate: new Date().toISOString().slice(0, 10),
    endTime: "17:00", startRoute: false,
  });

  // Merge API requests with manually added ones (deduplicated)
  const allRequests = useMemo(() => {
    const existingIds = new Set(requests.map(r => r.id));
    return [...requests, ...extraRequests.filter(r => !existingIds.has(r.id))];
  }, [requests, extraRequests]);

  function updateForm(key, value) { setForm(prev => ({ ...prev, [key]: value })); }
  function toggleOrder(id) { setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); }

  function handleAddRequest(req) {
    setExtraRequests(prev => [req, ...prev]);
    setSelectedIds(prev => [...prev, req.id]); // auto-select
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      await onCreateRoute({
        name: form.name,
        truckId: selectedTruck?.id || "",
        truckName: selectedTruck?.name || selectedTruck?.plate || "",
        driverName: selectedTruck?.driverName || "",
        driverPhone: selectedTruck?.driverPhone || "",
        plannedDate: form.startDate,
        requestIds: selectedIds,
        orderedRequestIds: selectedIds,
        optimizationMode: "visual_manual",
        startRoute: form.startRoute,
      });
      setSuccess("Ruta creada exitosamente");
      setStep(1);
      setSelectedTruck(null);
      setSelectedIds([]);
      setForm({ name: "", startDate: new Date().toISOString().slice(0, 10), startTime: "09:00", endDate: new Date().toISOString().slice(0, 10), endTime: "17:00", startRoute: false });
      setTimeout(() => setSuccess(""), 4000);
    } finally {
      setLoading(false);
    }
  }

  if (view === "list") return <RoutesListView routes={routes} requests={allRequests} onBack={() => setView("wizard")} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-dropit-accent">Logística</p>
          <h2 className="text-2xl font-black text-slate-800">Planificación de Rutas</h2>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setView("list")}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm">
            <Eye size={15} />Ver rutas ({routes.length})
          </button>
          <StepIndicator step={step} />
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <p className="text-sm font-medium text-emerald-700">{success}</p>
        </div>
      )}

      {step === 1 && <Step1Vehicles trucks={trucks} selectedTruck={selectedTruck} onSelectTruck={setSelectedTruck} form={form} onFormChange={updateForm} onNext={() => setStep(2)} />}
      {step === 2 && <Step2Visits requests={allRequests} selectedIds={selectedIds} onToggle={toggleOrder} onReorder={setSelectedIds} onNext={() => setStep(3)} onBack={() => setStep(1)} onAddRequest={handleAddRequest} />}
      {step === 3 && <Step3Routes requests={allRequests} selectedIds={selectedIds} selectedTruck={selectedTruck} form={form} onFormChange={updateForm} onReorder={setSelectedIds} routes={routes} onBack={() => setStep(2)} onSubmit={handleSubmit} loading={loading} />}
    </div>
  );
}
