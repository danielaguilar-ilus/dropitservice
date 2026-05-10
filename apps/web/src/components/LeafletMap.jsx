import { useEffect, useRef } from "react";

// Ensure Leaflet CSS loaded once globally
let leafletCssLoaded = false;
function ensureLeafletCss() {
  if (leafletCssLoaded || document.querySelector('link[href*="leaflet"]')) {
    leafletCssLoaded = true;
    return;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
  leafletCssLoaded = true;
}

// Santiago commune lat/lng lookup for geocoding fallback
const COMMUNE_COORDS = {
  "ñuñoa": [-33.4568, -70.5987],
  "las condes": [-33.4163, -70.5831],
  "providencia": [-33.4322, -70.6100],
  "santiago": [-33.4569, -70.6483],
  "maipú": [-33.5103, -70.7634],
  "maipu": [-33.5103, -70.7634],
  "la reina": [-33.4544, -70.5517],
  "lo barnechea": [-33.3632, -70.5155],
  "vitacura": [-33.3813, -70.5776],
  "san miguel": [-33.4972, -70.6583],
  "pedro aguirre cerda": [-33.4906, -70.6672],
  "la cisterna": [-33.5261, -70.6586],
  "el bosque": [-33.5625, -70.6697],
  "puente alto": [-33.6100, -70.5756],
  "la florida": [-33.5193, -70.5886],
  "peñalolén": [-33.4861, -70.5353],
  "penalolen": [-33.4861, -70.5353],
  "macul": [-33.4870, -70.5892],
  "san bernardo": [-33.5898, -70.7004],
  "cerrillos": [-33.4967, -70.7083],
  "quinta normal": [-33.4356, -70.6806],
  "lo espejo": [-33.5175, -70.7006],
  "cerro navia": [-33.4266, -70.7336],
  "pudahuel": [-33.4392, -70.7642],
  "quilicura": [-33.3612, -70.7369],
  "conchalí": [-33.3852, -70.6678],
  "huechuraba": [-33.3576, -70.6597],
  "recoleta": [-33.4111, -70.6436],
  "independencia": [-33.4233, -70.6542],
  "estacion central": [-33.4561, -70.6783],
  "estación central": [-33.4561, -70.6783],
  "rancagua": [-34.1703, -70.7444],
};

export function getCoordsByCommune(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [key, coords] of Object.entries(COMMUNE_COORDS)) {
    if (lower.includes(key)) return coords;
  }
  return null;
}

// Haversine distance (km)
export function haversine([lat1, lng1], [lat2, lng2]) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Nearest neighbor route optimization
export function optimizeRoute(locations) {
  if (!locations || locations.length <= 2) return locations;
  const origin = locations[0];
  const remaining = [...locations.slice(1)];
  const path = [origin];
  while (remaining.length > 0) {
    const last = path[path.length - 1];
    let minDist = Infinity;
    let minIdx = 0;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversine(last.coords, remaining[i].coords);
      if (d < minDist) { minDist = d; minIdx = i; }
    }
    path.push(remaining.splice(minIdx, 1)[0]);
  }
  return path;
}

// Status → marker color
const STATUS_COLORS = {
  exitosa: "#10b981",
  pendiente: "#6366f1",
  en_ruta: "#F97316",
  fallida: "#ef4444",
  base: "#F97316",
  origin: "#1e3a5f",
};

function buildIcon(L, color, label, size = 28) {
  return L.divIcon({
    className: "",
    html: `<div style="
      position:relative;
      width:${size}px;height:${size}px;
      background:${color};
      border:2.5px solid #fff;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      box-shadow:0 3px 10px ${color}66;
    ">
      <span style="
        position:absolute;
        inset:0;
        display:flex;align-items:center;justify-content:center;
        transform:rotate(45deg);
        color:#fff;font-size:10px;font-weight:800;
        font-family:sans-serif;
      ">${label}</span>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

// Fetch real road route via OSRM (open, no API key needed)
async function fetchOsrmRoute(waypoints) {
  if (!waypoints || waypoints.length < 2) return null;
  try {
    const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const data = await res.json();
    if (data.code === "Ok" && data.routes[0]) {
      return data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    }
  } catch {
    // fallback to straight lines if OSRM unavailable
  }
  return null;
}

/**
 * LeafletMap — reusable Leaflet map component
 *
 * Props:
 *   markers: Array<{ coords:[lat,lng], label, status, popup? }>
 *   polyline: Array<[lat,lng]> — route line points
 *   routing: boolean — use OSRM real road routing (default false)
 *   closedLoop: boolean — append origin to end of route (closed loop)
 *   multiRoutes: Array<{ waypoints:[lat,lng][], color:string, markers:marker[], label:string }>
 *   center: [lat,lng]
 *   zoom: number
 *   dark: boolean (dark tiles)
 *   height: string (CSS height, default "100%")
 *   onMapReady: (map) => void
 *   fitBounds: boolean — auto-fit all markers
 */
export default function LeafletMap({
  markers = [],
  polyline = [],
  routing = false,
  closedLoop = false,
  multiRoutes = [],
  center = [-33.45, -70.65],
  zoom = 11,
  dark = true,
  height = "100%",
  onMapReady,
  fitBounds = false,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerGroupRef = useRef(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current) return;
    let isMounted = true;

    import("leaflet").then((mod) => {
      const L = mod.default || mod;
      if (!isMounted || !containerRef.current || mapRef.current) return;
      ensureLeafletCss();

      const map = L.map(containerRef.current, {
        center,
        zoom,
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: false,
      });

      const tileUrl = dark
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

      L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(map);
      L.control.attribution({ prefix: false }).addTo(map);

      layerGroupRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      if (onMapReady) onMapReady(map);
    });

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, []);

  // Update markers and polyline when data changes
  useEffect(() => {
    if (!mapRef.current || !layerGroupRef.current) return;
    let cancelled = false;

    async function drawSingleRoute(L, routePoints, color, isDashed) {
      if (routePoints.length < 2) return null;
      let lineCoords = routePoints;
      if (routing) {
        const osrm = await fetchOsrmRoute(routePoints);
        if (!cancelled && osrm) lineCoords = osrm;
      }
      if (cancelled || !layerGroupRef.current) return null;
      return L.polyline(lineCoords, {
        color,
        weight: routing ? 4 : 3,
        opacity: 0.9,
        dashArray: isDashed ? "8 6" : null,
      }).addTo(layerGroupRef.current);
    }

    async function draw() {
      const mod = await import("leaflet");
      const L = mod.default || mod;
      if (cancelled || !layerGroupRef.current) return;
      layerGroupRef.current.clearLayers();

      const allBoundsPoints = [];

      // ── Multi-route mode ──
      if (multiRoutes.length > 0) {
        for (const route of multiRoutes) {
          if (cancelled) break;
          const wps = [...route.waypoints];
          if (closedLoop && wps.length > 1) wps.push(wps[0]);
          await drawSingleRoute(L, wps, route.color, false);

          // Draw route markers
          const rMarkers = route.markers || [];
          rMarkers.forEach((m, idx) => {
            if (!m.coords) return;
            allBoundsPoints.push(m.coords);
            const color = route.color;
            const label = idx === 0 ? "⬤" : String(idx);
            const icon = buildIcon(L, color, label, idx === 0 ? 30 : 24);
            const mk = L.marker(m.coords, { icon }).addTo(layerGroupRef.current);
            if (m.popup || m.label) {
              mk.bindPopup(`<div style="font-family:sans-serif;font-size:12px;font-weight:600;color:#1a1a1a;min-width:130px">${m.popup || m.label}</div>`, { maxWidth: 220 });
            }
          });
        }
      } else {
        // ── Single route mode ──
        const validMarkers = markers.filter((m) => m.coords);
        const routePoints = polyline.length > 1 ? polyline : validMarkers.map((m) => m.coords);
        const loopedPoints = closedLoop && routePoints.length > 1 ? [...routePoints, routePoints[0]] : routePoints;

        if (loopedPoints.length > 1) {
          await drawSingleRoute(L, loopedPoints, "#F97316", !routing);
        }

        if (cancelled || !layerGroupRef.current) return;

        validMarkers.forEach((m, idx) => {
          allBoundsPoints.push(m.coords);
          const color = STATUS_COLORS[m.status] || STATUS_COLORS.pendiente;
          const label = m.status === "base" ? "🚛" : String(idx === 0 ? "🏠" : idx);
          const icon = buildIcon(L, color, label);
          const marker = L.marker(m.coords, { icon }).addTo(layerGroupRef.current);
          if (m.popup || m.label) {
            marker.bindPopup(
              `<div style="font-family:sans-serif;font-size:13px;font-weight:600;color:#1a1a1a;min-width:140px">${m.popup || m.label}</div>`,
              { maxWidth: 220 }
            );
          }
        });
      }

      // Fit bounds
      if (fitBounds && allBoundsPoints.length > 0) {
        mapRef.current?.fitBounds(L.latLngBounds(allBoundsPoints), { padding: [40, 40] });
      }
    }

    draw();
    return () => { cancelled = true; };
  }, [markers, polyline, fitBounds, routing, closedLoop, multiRoutes]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%", zIndex: 0 }}
      className="rounded-xl overflow-hidden"
    />
  );
}
