/**
 * DriverNavigationMode — Modo GPS para conductores
 *
 * Pantalla completa estilo UberEats/Rappi:
 *  • Mapa Leaflet con posición GPS en tiempo real (truck marker animado)
 *  • Ruta trazada via OSRM hasta la parada actual
 *  • Panel inferior deslizable con info de la parada
 *  • Deep-links a Waze y Google Maps para navegación real
 *  • Alerta de proximidad (< 150m) — "¿Ya llegaste?"
 *  • Confirmación de entrega / pedido fallido inline
 *
 * Props:
 *   route    — objeto ruta
 *   stops    — array de pedidos (ya filtrados y ordenados)
 *   onExit   — callback para volver a la lista
 *   DeliveryModalComponent  — componente modal de entrega
 *   FailureModalComponent   — componente modal de falla
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
  MapPin, Navigation, Package, Phone, X, Zap,
} from "lucide-react";

// ─── Haversine distance (km) ─────────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km) {
  if (km == null) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function formatEta(km) {
  if (km == null) return "—";
  const mins = Math.round((km / 30) * 60); // 30 km/h promedio ciudad
  if (mins < 2) return "Llegando";
  if (mins < 60) return `~${mins} min`;
  return `~${Math.floor(mins / 60)}h ${mins % 60}min`;
}

// ─── Nominatim geocoder (con caché) ──────────────────────────────────────────
const GEO_CACHE = new Map();
async function geocodeAddress(addr) {
  if (GEO_CACHE.has(addr)) return GEO_CACHE.get(addr);
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr + ", Chile")}&limit=1&countrycodes=cl`;
    const res = await fetch(url, { headers: { "Accept-Language": "es" } });
    const data = await res.json();
    if (data[0]) {
      const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      GEO_CACHE.set(addr, coords);
      return coords;
    }
  } catch {}
  return null;
}

// ─── CSS for truck animation ──────────────────────────────────────────────────
const NAV_CSS_ID = "dropit-nav-css";
function injectNavCss() {
  if (document.getElementById(NAV_CSS_ID)) return;
  const s = document.createElement("style");
  s.id = NAV_CSS_ID;
  s.textContent = `
    @keyframes nav-truck-pulse {
      0%,100% { box-shadow: 0 0 0 0 rgba(249,115,22,0.5); }
      50%      { box-shadow: 0 0 0 14px rgba(249,115,22,0); }
    }
    @keyframes nav-proximity-flash {
      0%,100% { background: #10b981; }
      50%      { background: #059669; }
    }
    .nav-truck-dot { animation: nav-truck-pulse 1.5s ease-in-out infinite; }
    .nav-proximity { animation: nav-proximity-flash 1s ease-in-out infinite; }
  `;
  document.head.appendChild(s);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DriverNavigationMode({
  route,
  stops,
  onExit,
  DeliveryModal,
  FailureModal,
}) {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const truckMarkerRef  = useRef(null);
  const stopMarkersRef  = useRef([]);
  const routeLineRef    = useRef(null);
  const watchIdRef      = useRef(null);

  const [gpsPos,       setGpsPos]       = useState(null);
  const [gpsError,     setGpsError]     = useState("");
  const [stopCoords,   setStopCoords]   = useState({});  // id → {lat,lng}
  const [currentIdx,   setCurrentIdx]   = useState(0);
  const [stopStatuses, setStopStatuses] = useState({});  // id → "pending"|"active"|"done"|"failed"
  const [distance,     setDistance]     = useState(null);
  const [panelOpen,    setPanelOpen]    = useState(true);
  const [proximity,    setProximity]    = useState(false); // < 150m
  const [deliveryStop, setDeliveryStop] = useState(null);
  const [failureStop,  setFailureStop]  = useState(null);

  const currentStop = stops[currentIdx] || null;
  const completed   = stops.filter((_, i) => {
    const s = stopStatuses[stops[i]?.id];
    return s === "done" || s === "failed";
  }).length;
  const allDone = completed === stops.length;

  // ── 1. Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;
    let cancelled = false;
    injectNavCss();

    import("leaflet").then((Lm) => {
      const L = Lm.default || Lm;
      if (cancelled || !mapContainerRef.current || mapRef.current) return;

      if (!document.querySelector('link[href*="leaflet"]')) {
        const lk = document.createElement("link");
        lk.rel = "stylesheet";
        lk.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(lk);
      }

      const map = L.map(mapContainerRef.current, {
        center: [-33.45, -70.65],
        zoom: 14,
        zoomControl: false,
      });

      // Voyager tiles — light, road-focused
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 19, subdomains: "abcd",
        attribution: '<span style="font-size:9px;opacity:0.5">© OSM © CARTO</span>',
      }).addTo(map);

      L.control.zoom({ position: "topright" }).addTo(map);
      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  // ── 2. GPS watchPosition ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError("GPS no disponible en este navegador. Usa el teléfono.");
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => setGpsPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setGpsError("No se pudo obtener tu ubicación GPS."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 4000 }
    );
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, []);

  // ── 3. Update truck marker on map when GPS changes ───────────────────────────
  useEffect(() => {
    if (!gpsPos || !mapRef.current) return;
    import("leaflet").then((Lm) => {
      const L = Lm.default || Lm;
      if (!mapRef.current) return;

      const truckHtml = `
        <div style="position:relative;width:44px;height:44px;">
          <div class="nav-truck-dot" style="
            position:absolute;top:50%;left:50%;
            transform:translate(-50%,-50%);
            width:24px;height:24px;
            background:#F97316;
            border:3px solid #fff;
            border-radius:50%;
            box-shadow:0 2px 8px rgba(249,115,22,0.6);
          "></div>
          <div style="
            position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);
            background:#F97316;color:#fff;
            font-size:9px;font-weight:900;
            padding:1px 5px;border-radius:6px;
            white-space:nowrap;
            font-family:system-ui,sans-serif;
          ">🚛 Tú</div>
        </div>`;

      const icon = L.divIcon({
        className: "", html: truckHtml,
        iconSize: [44, 44], iconAnchor: [22, 22],
      });

      if (truckMarkerRef.current) {
        truckMarkerRef.current.setLatLng([gpsPos.lat, gpsPos.lng]);
      } else {
        truckMarkerRef.current = L.marker([gpsPos.lat, gpsPos.lng], { icon, zIndexOffset: 1000 })
          .addTo(mapRef.current);
        mapRef.current.setView([gpsPos.lat, gpsPos.lng], 15, { animate: true });
      }

      // Distance to current stop
      const coords = currentStop ? stopCoords[currentStop.id] : null;
      if (coords) {
        const km = haversineKm(gpsPos.lat, gpsPos.lng, coords.lat, coords.lng);
        setDistance(km);
        setProximity(km < 0.15); // < 150m
      }
    });
  }, [gpsPos, currentStop, stopCoords]);

  // ── 4. Geocode stops sequentially ───────────────────────────────────────────
  useEffect(() => {
    let active = true;
    (async () => {
      for (const stop of stops) {
        if (!active) break;
        if (stopCoords[stop.id]) continue;
        const coords = await geocodeAddress(stop.deliveryAddress);
        if (coords && active) {
          setStopCoords(prev => ({ ...prev, [stop.id]: coords }));
        }
        await new Promise(r => setTimeout(r, 400)); // rate limit
      }
    })();
    return () => { active = false; };
  }, [stops]);

  // ── 5. Draw stop markers on map when coords arrive ───────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((Lm) => {
      const L = Lm.default || Lm;
      // Remove old stop markers
      stopMarkersRef.current.forEach(m => m.setMap ? m.setMap(null) : mapRef.current?.removeLayer(m));
      stopMarkersRef.current = [];

      stops.forEach((stop, i) => {
        const coords = stopCoords[stop.id];
        if (!coords) return;
        const status = stopStatuses[stop.id];
        const isActive  = i === currentIdx && !status;
        const isDone    = status === "done";
        const isFailed  = status === "failed";

        const bg    = isDone ? "#10b981" : isFailed ? "#ef4444" : isActive ? "#F97316" : "#94a3b8";
        const label = isDone ? "✓" : isFailed ? "✕" : String(i + 1);

        const icon = L.divIcon({
          className: "",
          html: `<div style="
            width:30px;height:30px;
            background:${bg};border:2.5px solid #fff;
            border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            font-size:${isDone || isFailed ? "13px" : "11px"};font-weight:900;color:#fff;
            font-family:system-ui,sans-serif;
            box-shadow:0 2px 8px rgba(0,0,0,0.25);
            ${isActive ? "box-shadow:0 0 0 4px rgba(249,115,22,0.3),0 2px 8px rgba(249,115,22,0.4);" : ""}
          ">${label}</div>`,
          iconSize: [30, 30], iconAnchor: [15, 15],
        });
        const mk = L.marker([coords.lat, coords.lng], { icon })
          .bindPopup(`<strong style="font-family:system-ui;font-size:12px">${i + 1}. ${stop.customerName}</strong><br><span style="font-size:11px;color:#555">${stop.deliveryAddress}</span>`)
          .addTo(mapRef.current);
        stopMarkersRef.current.push(mk);
      });
    });
  }, [stopCoords, currentIdx, stopStatuses, stops]);

  // ── 6. Draw OSRM route from GPS to current stop ──────────────────────────────
  useEffect(() => {
    if (!gpsPos || !currentStop) return;
    const coords = stopCoords[currentStop.id];
    if (!coords || !mapRef.current) return;

    const url = `https://router.project-osrm.org/route/v1/driving/${gpsPos.lng},${gpsPos.lat};${coords.lng},${coords.lat}?overview=full&geometries=geojson`;

    import("leaflet").then((Lm) => {
      const L = Lm.default || Lm;
      fetch(url)
        .then(r => r.json())
        .then(data => {
          if (!mapRef.current) return;
          if (routeLineRef.current) mapRef.current.removeLayer(routeLineRef.current);
          const geometry = data.routes?.[0]?.geometry;
          if (geometry) {
            const latlngs = geometry.coordinates.map(([lng, lat]) => [lat, lng]);
            routeLineRef.current = L.polyline(latlngs, {
              color: "#F97316", weight: 5, opacity: 0.8, lineCap: "round",
            }).addTo(mapRef.current);
          }
        })
        .catch(() => {
          // Fallback: straight line
          import("leaflet").then((Lm2) => {
            const L2 = Lm2.default || Lm2;
            if (!mapRef.current) return;
            if (routeLineRef.current) mapRef.current.removeLayer(routeLineRef.current);
            routeLineRef.current = L2.polyline(
              [[gpsPos.lat, gpsPos.lng], [coords.lat, coords.lng]],
              { color: "#F97316", weight: 4, opacity: 0.6, dashArray: "8 6" }
            ).addTo(mapRef.current);
          });
        });
    });
  }, [gpsPos, currentStop, stopCoords]);

  // ── Navigate deep links ──────────────────────────────────────────────────────
  function openWaze() {
    if (!currentStop) return;
    const q = encodeURIComponent(currentStop.deliveryAddress + ", Chile");
    window.open(`https://waze.com/ul?q=${q}&navigate=yes`, "_blank");
  }

  function openGoogleMaps() {
    if (!currentStop) return;
    const dest = encodeURIComponent(currentStop.deliveryAddress + ", Chile");
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`, "_blank");
  }

  // ── Advance to next stop ─────────────────────────────────────────────────────
  function advanceToNextStop(completedId, resultStatus) {
    setStopStatuses(prev => ({ ...prev, [completedId]: resultStatus }));
    setProximity(false);
    setDistance(null);
    if (routeLineRef.current && mapRef.current) {
      mapRef.current.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }
    const nextIdx = currentIdx + 1;
    if (nextIdx < stops.length) {
      setCurrentIdx(nextIdx);
      // Pan map to next stop
      const nextCoords = stopCoords[stops[nextIdx].id];
      if (nextCoords && mapRef.current) {
        mapRef.current.setView([nextCoords.lat, nextCoords.lng], 15, { animate: true });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-100 overflow-hidden">

      {/* ── Modals ── */}
      {deliveryStop && DeliveryModal && (
        <DeliveryModal
          stop={deliveryStop}
          onClose={() => setDeliveryStop(null)}
          onConfirm={(data) => {
            advanceToNextStop(deliveryStop.id, "done");
            setDeliveryStop(null);
            if (onExit?._onDeliverStop) onExit._onDeliverStop(deliveryStop.id, data);
          }}
        />
      )}
      {failureStop && FailureModal && (
        <FailureModal
          stop={failureStop}
          onClose={() => setFailureStop(null)}
          onConfirm={(data) => {
            advanceToNextStop(failureStop.id, "failed");
            setFailureStop(null);
          }}
        />
      )}

      {/* ── Top overlay bar ── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-4 py-3"
        style={{ background: "linear-gradient(to bottom,rgba(255,255,255,0.97) 0%,rgba(255,255,255,0.85) 70%,transparent 100%)" }}>
        <button onClick={onExit}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
          <X size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-dropit-accent leading-none">Modo navegación</p>
          <p className="truncate text-sm font-bold text-slate-800">{route.name || route.id}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm border border-slate-200">
          <span className="text-sm font-black text-dropit-accent">{completed}</span>
          <span className="text-[10px] text-slate-400">/</span>
          <span className="text-sm font-black text-slate-700">{stops.length}</span>
          <span className="ml-1 text-[10px] text-slate-500">paradas</span>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className="absolute top-[60px] left-0 right-0 z-20 h-1.5 bg-slate-200">
        <div className="h-full bg-dropit-accent transition-all duration-500"
          style={{ width: `${stops.length > 0 ? (completed / stops.length) * 100 : 0}%` }} />
      </div>

      {/* ── GPS Error banner ── */}
      {gpsError && (
        <div className="absolute top-[72px] left-4 right-4 z-20 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 shadow-sm">
          <AlertCircle size={14} className="text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700 font-medium">{gpsError}</p>
        </div>
      )}

      {/* ── Map ── */}
      <div ref={mapContainerRef} className="absolute inset-0 z-10" />

      {/* ── Completed screen ── */}
      {allDone && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="mx-4 rounded-2xl bg-white p-8 text-center shadow-2xl">
            <CheckCircle2 size={52} className="mx-auto mb-3 text-emerald-500" />
            <p className="text-2xl font-black text-slate-800">¡Ruta completada!</p>
            <p className="mt-1 text-sm text-slate-500">{stops.length} entregas procesadas</p>
            <button onClick={onExit}
              className="mt-5 rounded-xl bg-dropit-accent px-8 py-3 text-sm font-bold text-white hover:bg-dropit-accent/90">
              Volver al panel
            </button>
          </div>
        </div>
      )}

      {/* ── Bottom panel ── */}
      {!allDone && currentStop && (
        <div className={`absolute bottom-0 left-0 right-0 z-20 rounded-t-3xl bg-white shadow-2xl transition-all duration-300 ${panelOpen ? "" : "translate-y-[calc(100%-80px)]"}`}
          style={{ maxHeight: "72vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>

          {/* Panel handle / header */}
          <button onClick={() => setPanelOpen(p => !p)}
            className="flex w-full flex-col items-center px-5 pt-3 pb-2 focus:outline-none">
            <div className="mb-2 h-1 w-10 rounded-full bg-slate-200" />
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black text-white ${proximity ? "nav-proximity" : "bg-dropit-accent"}`}>
                  {currentIdx + 1}
                </div>
                <div className="text-left">
                  <p className="text-sm font-black text-slate-900 leading-none">{currentStop.customerName}</p>
                  {distance != null && (
                    <p className={`text-[11px] font-semibold ${proximity ? "text-emerald-600" : "text-dropit-accent"}`}>
                      {proximity ? "🎯 ¡Ya llegaste!" : `📍 ${formatDistance(distance)} · ${formatEta(distance)}`}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {distance != null && !proximity && (
                  <span className="rounded-full bg-dropit-accent/10 px-2 py-0.5 text-[11px] font-bold text-dropit-accent">
                    {formatEta(distance)}
                  </span>
                )}
                {panelOpen ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronUp size={16} className="text-slate-400" />}
              </div>
            </div>
          </button>

          {/* Panel body (scrollable) */}
          <div className="overflow-y-auto px-5 pb-6 space-y-4 flex-1">

            {/* Address + cargo */}
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <MapPin size={13} className="mt-0.5 flex-shrink-0 text-dropit-accent" />
                <p className="text-sm text-slate-700 font-medium">{currentStop.deliveryAddress}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span><Package size={10} className="inline mr-1" />{currentStop.packages} bultos · {currentStop.estimatedWeightKg} kg</span>
                {currentStop.contactPhone && (
                  <a href={`tel:${currentStop.contactPhone}`} className="flex items-center gap-1 text-dropit-accent font-semibold">
                    <Phone size={10} />{currentStop.contactPhone}
                  </a>
                )}
              </div>
              {currentStop.cargoDescription && (
                <p className="text-[11px] text-slate-400 leading-relaxed">{currentStop.cargoDescription}</p>
              )}
            </div>

            {/* Proximity alert */}
            {proximity && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                <Zap size={16} className="text-emerald-600 flex-shrink-0 animate-bounce" />
                <p className="text-sm font-bold text-emerald-700">
                  Estás a menos de 150m — ¿Ya llegaste a la parada?
                </p>
              </div>
            )}

            {/* Navigate buttons */}
            <div className="space-y-2">
              <button onClick={openWaze}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00b7f4] py-3 text-sm font-bold text-white shadow-md shadow-cyan-300/30 hover:bg-[#00a3d9] transition-colors active:scale-[0.98]">
                <span className="text-base">🚗</span> Navegar con Waze
              </button>
              <button onClick={openGoogleMaps}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors active:scale-[0.98]">
                <span className="text-base">🗺️</span> Abrir en Google Maps
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-100" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Confirmar estado</span>
              <div className="h-px flex-1 bg-slate-100" />
            </div>

            {/* Delivery / Failure actions */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setDeliveryStop(currentStop)}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl py-4 text-sm font-bold text-white shadow-md transition-all active:scale-[0.97] ${
                  proximity
                    ? "bg-emerald-500 shadow-emerald-300/50 scale-[1.02]"
                    : "bg-emerald-500 shadow-emerald-200/50"
                }`}>
                <CheckCircle2 size={22} />
                <span>Entregado</span>
              </button>
              <button onClick={() => setFailureStop(currentStop)}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-red-200 bg-red-50 py-4 text-sm font-bold text-red-600 transition-all active:scale-[0.97] hover:bg-red-100">
                <AlertCircle size={22} />
                <span>Fallido</span>
              </button>
            </div>

            {/* Skip / next stop */}
            {stops.length > 1 && currentIdx < stops.length - 1 && (
              <button
                onClick={() => setCurrentIdx(i => Math.min(i + 1, stops.length - 1))}
                className="w-full rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors">
                Saltar parada → ir a parada {currentIdx + 2}
              </button>
            )}

            {/* Remaining stops mini list */}
            {stops.length > 1 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Próximas paradas</p>
                {stops.slice(currentIdx + 1, currentIdx + 4).map((s, i) => {
                  const st = stopStatuses[s.id];
                  return (
                    <div key={s.id} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs ${st === "done" ? "border-emerald-100 bg-emerald-50" : st === "failed" ? "border-red-100 bg-red-50" : "border-slate-100 bg-slate-50"}`}>
                      <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-black text-white ${st === "done" ? "bg-emerald-500" : st === "failed" ? "bg-red-400" : "bg-slate-300"}`}>
                        {st === "done" ? "✓" : st === "failed" ? "✕" : currentIdx + i + 2}
                      </span>
                      <span className={`truncate font-medium ${st === "done" ? "text-emerald-700 line-through" : "text-slate-600"}`}>
                        {s.customerName} — {s.deliveryAddress}
                      </span>
                    </div>
                  );
                })}
                {stops.length - currentIdx - 1 > 3 && (
                  <p className="text-[10px] text-slate-400 text-center">+{stops.length - currentIdx - 4} paradas más</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
