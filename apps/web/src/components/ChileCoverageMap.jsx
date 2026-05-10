/**
 * ChileCoverageMap — Mapa animado de cobertura nacional
 *
 * Muestra una ruta animada Arica → Punta Arenas con marcadores
 * pulsantes y efectos WOW. No requiere Google Maps API Key.
 */
import { useEffect, useRef } from "react";

// ─── Ruta principal de Chile (norte → sur) ──────────────────────────────────
const CHILE_ROUTE = [
  { name: "Arica",         lat: -18.4783, lng: -70.3126, type: "endpoint" },
  { name: "Iquique",       lat: -20.2308, lng: -70.1356, type: "major" },
  { name: "Calama",        lat: -22.4628, lng: -68.9246, type: "city" },
  { name: "Antofagasta",   lat: -23.6509, lng: -70.3975, type: "major" },
  { name: "Copiapó",       lat: -27.3668, lng: -70.3323, type: "major" },
  { name: "La Serena",     lat: -29.9027, lng: -71.2520, type: "major" },
  { name: "Viña del Mar",  lat: -33.0153, lng: -71.5500, type: "city" },
  { name: "Valparaíso",    lat: -33.0472, lng: -71.6127, type: "major" },
  { name: "Santiago",      lat: -33.4569, lng: -70.6483, type: "hub" },
  { name: "Rancagua",      lat: -34.1703, lng: -70.7449, type: "city" },
  { name: "Talca",         lat: -35.4264, lng: -71.6554, type: "city" },
  { name: "Concepción",    lat: -36.8201, lng: -73.0444, type: "major" },
  { name: "Temuco",        lat: -38.7359, lng: -72.5904, type: "major" },
  { name: "Valdivia",      lat: -39.8142, lng: -73.2459, type: "city" },
  { name: "Puerto Montt",  lat: -41.4693, lng: -72.9424, type: "major" },
  { name: "Coyhaique",     lat: -45.5712, lng: -72.0680, type: "city" },
  { name: "Punta Arenas",  lat: -53.1638, lng: -70.9171, type: "endpoint" },
];

// Ramales secundarios (conectan a ciudades fuera del eje principal)
const BRANCH_ROUTES = [
  // Calama → Antofagasta (el punto en Calama ya está en la ruta, esto es visual)
  [{ lat: -22.4628, lng: -68.9246 }, { lat: -23.6509, lng: -70.3975 }],
  // Santiago → San Antonio (costa)
  [{ lat: -33.4569, lng: -70.6483 }, { lat: -33.5932, lng: -71.6127 }],
  // Temuco → Puerto Montt alternativa costera
  [{ lat: -38.7359, lng: -72.5904 }, { lat: -41.4693, lng: -72.9424 }],
];

const TYPE_CONFIG = {
  endpoint: { r: 10, color: "#F97316", pulse: true,  ring: true,  label: true,  labelSize: 13, labelWeight: "900" },
  hub:      { r: 14, color: "#F97316", pulse: true,  ring: true,  label: true,  labelSize: 13, labelWeight: "900" },
  major:    { r: 7,  color: "#fb923c", pulse: false, ring: false, label: true,  labelSize: 11, labelWeight: "700" },
  city:     { r: 5,  color: "#fdba74", pulse: false, ring: false, label: false, labelSize: 10, labelWeight: "600" },
};

const CSS_ID = "dropit-chile-map-css";

function injectCss() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement("style");
  s.id = CSS_ID;
  s.textContent = `
    @keyframes dropit-pulse {
      0%   { transform: translate(-50%,-50%) scale(1);   opacity: 0.9; }
      70%  { transform: translate(-50%,-50%) scale(3.2); opacity: 0; }
      100% { transform: translate(-50%,-50%) scale(1);   opacity: 0; }
    }
    @keyframes dropit-pop {
      0%   { transform: translate(-50%,-50%) scale(0);   opacity: 0; }
      65%  { transform: translate(-50%,-50%) scale(1.35);opacity: 1; }
      100% { transform: translate(-50%,-50%) scale(1);   opacity: 1; }
    }
    @keyframes dropit-glow {
      0%, 100% { box-shadow: 0 0 8px 3px rgba(249,115,22,0.5); }
      50%       { box-shadow: 0 0 18px 7px rgba(249,115,22,0.8); }
    }
    .dropit-city-dot {
      position: absolute; top: 50%; left: 50%;
      border-radius: 50%;
      animation: dropit-pop 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards;
    }
    .dropit-pulse-ring {
      position: absolute; top: 50%; left: 50%;
      border-radius: 50%;
      animation: dropit-pulse 2s ease-out infinite;
      pointer-events: none;
    }
    .dropit-hub-glow { animation: dropit-glow 2s ease-in-out infinite; }
  `;
  document.head.appendChild(s);
}

function makeMarkerHtml(city) {
  const cfg = TYPE_CONFIG[city.type];
  const d = cfg.r * 2;
  const outer = cfg.r * 4.5;

  return `
    <div style="position:relative;width:${outer}px;height:${outer}px;">
      ${cfg.ring ? `
        <div class="dropit-pulse-ring" style="
          width:${d * 2.2}px;height:${d * 2.2}px;
          background:${cfg.color}44;
          border:2px solid ${cfg.color}88;
        "></div>
        <div class="dropit-pulse-ring" style="
          width:${d * 1.5}px;height:${d * 1.5}px;
          background:${cfg.color}55;
          border:1.5px solid ${cfg.color}99;
          animation-delay:0.6s;
        "></div>
      ` : ""}
      <div class="dropit-city-dot ${city.type === "hub" ? "dropit-hub-glow" : ""}" style="
        width:${d}px;height:${d}px;
        background:${cfg.color};
        border:${city.type === "hub" ? "3px" : "2px"} solid rgba(255,255,255,0.9);
        box-shadow:0 2px 8px ${cfg.color}80;
      "></div>
      ${cfg.label ? `
        <div style="
          position:absolute;
          top:${cfg.r + 10}px;
          left:50%;transform:translateX(-50%);
          white-space:nowrap;
          font-family:'Inter',system-ui,sans-serif;
          font-size:${cfg.labelSize}px;
          font-weight:${cfg.labelWeight};
          color:${city.type === "hub" ? "#F97316" : "rgba(255,255,255,0.92)"};
          text-shadow:0 1px 4px rgba(0,0,0,0.9),0 0 8px rgba(0,0,0,0.6);
          pointer-events:none;
          letter-spacing:${city.type === "hub" ? "0.3px" : "0"};
        ">${city.name}</div>
      ` : ""}
    </div>`;
}

export default function ChileCoverageMap({ height = "520px" }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let mapInstance = null;
    let animTimer = null;
    let branchTimer = null;

    injectCss();

    import("leaflet").then((Lmod) => {
      const L = Lmod.default || Lmod;
      if (cancelled || !containerRef.current) return;

      // Leaflet CSS
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      // Create map centered on Chile
      const map = L.map(containerRef.current, {
        center: [-37, -71],
        zoom: 4,
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: false,
        preferCanvas: false,
      });
      mapInstance = map;

      // Light CartoDB Voyager tiles — se ve de día, bonito y nítido
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        subdomains: "abcd",
      }).addTo(map);

      // Small attribution
      L.control.attribution({ position: "bottomright", prefix: false })
        .addAttribution('<span style="font-size:9px;opacity:0.5;color:#444">© OSM © CARTO</span>')
        .addTo(map);

      // Fit Chile bounds — más ajustado para que se vea el país completo de cerca
      map.fitBounds([[-54.0, -74.5], [-18.0, -67.5]], { padding: [30, 60] });

      // ── Animated main polyline ─────────────────────────────────────
      const mainLine = L.polyline([], {
        color: "#F97316",
        weight: 2.5,
        opacity: 0.85,
        dashArray: "10 5",
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      // Draw branch lines (subtle, lower opacity)
      BRANCH_ROUTES.forEach((pts) => {
        L.polyline(pts.map(p => [p.lat, p.lng]), {
          color: "#fb923c",
          weight: 1.5,
          opacity: 0.35,
          dashArray: "6 8",
        }).addTo(map);
      });

      // ── Animate city by city ────────────────────────────────────────
      let step = 0;

      function tick() {
        if (cancelled || step >= CHILE_ROUTE.length) return;

        const city = CHILE_ROUTE[step];
        // Grow the polyline
        const pts = CHILE_ROUTE.slice(0, step + 1).map(c => [c.lat, c.lng]);
        mainLine.setLatLngs(pts);

        // Add marker
        const iconSize = TYPE_CONFIG[city.type].r * 4.5;
        const icon = L.divIcon({
          className: "",
          html: makeMarkerHtml(city),
          iconSize: [iconSize, iconSize],
          iconAnchor: [iconSize / 2, iconSize / 2],
        });
        L.marker([city.lat, city.lng], { icon, interactive: false, keyboard: false }).addTo(map);

        step++;
        if (step < CHILE_ROUTE.length) {
          animTimer = setTimeout(tick, 270);
        }
      }

      // Start animation with a brief delay for the tile render
      animTimer = setTimeout(tick, 600);
    });

    return () => {
      cancelled = true;
      if (animTimer)  clearTimeout(animTimer);
      if (branchTimer) clearTimeout(branchTimer);
      if (mapInstance) { mapInstance.remove(); mapInstance = null; }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%", borderRadius: "16px", overflow: "hidden", background: "#e8e0d8" }}
    />
  );
}
