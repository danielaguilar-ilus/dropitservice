/**
 * GoogleMap — componente de mapa Google Maps con routing real
 *
 * Requiere: VITE_GOOGLE_MAPS_API_KEY en apps/web/.env
 *
 * Props:
 *   waypoints: Array<{lat, lng, label, popup?}> — puntos de la ruta
 *   center: {lat, lng}
 *   zoom: number
 *   height: string
 *   routing: boolean — trazar ruta real por calles (Directions API)
 *   onMapReady: (map) => void
 *   markers: Array<{lat, lng, label, color?, icon?}>
 */

import { useEffect, useRef, useState } from "react";

const GMAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

let _loadPromise = null;

export function loadGoogleMaps() {
  if (typeof window === "undefined") return Promise.reject("SSR");
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (_loadPromise) return _loadPromise;

  _loadPromise = new Promise((resolve, reject) => {
    if (!GMAPS_KEY) {
      reject(new Error("Configura VITE_GOOGLE_MAPS_API_KEY en apps/web/.env"));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=places,geometry&callback=__gmapsLoaded`;
    script.async = true;
    script.defer = true;
    window.__gmapsLoaded = () => { resolve(window.google.maps); };
    script.onerror = () => reject(new Error("Error cargando Google Maps"));
    document.head.appendChild(script);
  });

  return _loadPromise;
}

export function isGoogleMapsConfigured() {
  return Boolean(GMAPS_KEY);
}

// Colores para marcadores numerados
const MARKER_COLORS = {
  base: "#F97316",
  stop: "#3b82f6",
  done: "#10b981",
  active: "#F97316",
};

export default function GoogleMap({
  waypoints = [],
  markers = [],
  center = { lat: -33.45, lng: -70.65 },
  zoom = 12,
  height = "400px",
  routing = false,
  dark = false,
  fitBounds = false,
  onMapReady,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const polylinesRef = useRef([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Init map
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    loadGoogleMaps()
      .then((gmaps) => {
        if (cancelled || !containerRef.current) return;

        const mapStyles = dark ? [{ elementType: "geometry", stylers: [{ color: "#1a1a2e" }] }] : [];

        const map = new gmaps.Map(containerRef.current, {
          center,
          zoom,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          styles: dark ? mapStyles : [],
          mapTypeId: "roadmap",
        });

        mapRef.current = map;
        setLoading(false);
        if (onMapReady) onMapReady(map);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, []);

  // Draw markers and route when data changes
  useEffect(() => {
    if (!mapRef.current || loading) return;
    const gmaps = window.google?.maps;
    if (!gmaps) return;

    // Clear previous markers and lines
    markersRef.current.forEach(m => m.setMap(null));
    polylinesRef.current.forEach(p => p.setMap(null));
    markersRef.current = [];
    polylinesRef.current = [];

    const allPoints = [];

    // Draw waypoint markers (numbered)
    waypoints.forEach((wp, idx) => {
      if (!wp.lat || !wp.lng) return;
      const pos = { lat: wp.lat, lng: wp.lng };
      allPoints.push(pos);

      const isOrigin = idx === 0;
      const color = isOrigin ? MARKER_COLORS.base : MARKER_COLORS.stop;
      const label = isOrigin ? "🚛" : String(idx);

      const marker = new gmaps.Marker({
        position: pos,
        map: mapRef.current,
        title: wp.label || `Parada ${idx}`,
        label: {
          text: isOrigin ? "O" : String(idx),
          color: "#fff",
          fontWeight: "bold",
          fontSize: "12px",
        },
        icon: {
          path: gmaps.SymbolPath.CIRCLE,
          scale: 18,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
      });

      if (wp.popup || wp.label) {
        const infoWindow = new gmaps.InfoWindow({
          content: `<div style="font-family:sans-serif;font-size:13px;font-weight:600;color:#1a1a1a;min-width:140px;padding:4px 0">${wp.popup || wp.label}</div>`,
        });
        marker.addListener("click", () => infoWindow.open(mapRef.current, marker));
      }

      markersRef.current.push(marker);
    });

    // Draw extra markers
    markers.forEach((m) => {
      if (!m.lat || !m.lng) return;
      const pos = { lat: m.lat, lng: m.lng };
      allPoints.push(pos);
      const mk = new gmaps.Marker({
        position: pos,
        map: mapRef.current,
        title: m.label,
        icon: m.icon || {
          path: gmaps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 8,
          fillColor: m.color || "#F97316",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
      });
      markersRef.current.push(mk);
    });

    // Route drawing
    if (routing && waypoints.length >= 2) {
      const directionsService = new gmaps.DirectionsService();
      const directionsRenderer = new gmaps.DirectionsRenderer({
        suppressMarkers: true, // we have custom markers
        polylineOptions: {
          strokeColor: "#F97316",
          strokeWeight: 5,
          strokeOpacity: 0.9,
        },
      });
      directionsRenderer.setMap(mapRef.current);
      polylinesRef.current.push(directionsRenderer);

      const origin = { lat: waypoints[0].lat, lng: waypoints[0].lng };
      const destination = { lat: waypoints[waypoints.length - 1].lat, lng: waypoints[waypoints.length - 1].lng };
      const intermediates = waypoints.slice(1, -1).map(wp => ({ location: { lat: wp.lat, lng: wp.lng } }));

      // Google Maps Directions limits: max 25 waypoints total
      directionsService.route(
        {
          origin,
          destination,
          waypoints: intermediates.slice(0, 23),
          optimizeWaypoints: false,
          travelMode: gmaps.TravelMode.DRIVING,
          region: "cl",
        },
        (result, status) => {
          if (status === "OK") {
            directionsRenderer.setDirections(result);
          } else {
            // Fallback: draw straight polyline
            const polyline = new gmaps.Polyline({
              path: waypoints.map(wp => ({ lat: wp.lat, lng: wp.lng })),
              strokeColor: "#F97316",
              strokeWeight: 4,
              strokeOpacity: 0.7,
              geodesic: true,
            });
            polyline.setMap(mapRef.current);
            polylinesRef.current.push(polyline);
          }
        }
      );
    }

    // Fit bounds
    if (fitBounds && allPoints.length > 1) {
      const bounds = new gmaps.LatLngBounds();
      allPoints.forEach(p => bounds.extend(p));
      mapRef.current.fitBounds(bounds, { padding: 50 });
    } else if (allPoints.length === 1) {
      mapRef.current.setCenter(allPoints[0]);
    }
  }, [waypoints, markers, routing, fitBounds, loading]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-amber-200 bg-amber-50 p-6 text-center" style={{ height }}>
        <p className="text-sm font-bold text-amber-700">Google Maps no configurado</p>
        <p className="mt-1 text-xs text-amber-600 max-w-xs">{error}</p>
        <p className="mt-2 text-xs text-amber-500">Agrega <code className="font-mono bg-amber-100 px-1 rounded">VITE_GOOGLE_MAPS_API_KEY=tu_clave</code> en <code className="font-mono bg-amber-100 px-1 rounded">apps/web/.env</code></p>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", height, width: "100%" }}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100 rounded-xl">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-dropit-accent/20 border-t-dropit-accent" />
            <p className="text-xs text-slate-500">Cargando mapa...</p>
          </div>
        </div>
      )}
      <div ref={containerRef} style={{ height: "100%", width: "100%", borderRadius: "inherit" }} />
    </div>
  );
}

// ─── Google Places Autocomplete ────────────────────────────────────────────────
export function GooglePlacesSearch({ value, onChange, onSelect, placeholder, error: fieldError }) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!GMAPS_KEY) {
      setLocalError("API key no configurada");
      return;
    }

    loadGoogleMaps()
      .then((gmaps) => {
        if (!inputRef.current) return;

        const autocomplete = new gmaps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: "cl" },
          fields: ["formatted_address", "geometry", "address_components", "name"],
          types: ["address", "establishment"],
        });

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (!place.geometry) return;

          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const address = place.formatted_address || place.name || "";

          // Extract commune from address_components
          const commune =
            place.address_components?.find(c => c.types.includes("locality"))?.long_name ||
            place.address_components?.find(c => c.types.includes("sublocality"))?.long_name ||
            "";

          onChange(address);
          onSelect({ address, coords: [lat, lng], lat, lng, commune, raw: place });
        });

        autocompleteRef.current = autocomplete;
        setReady(true);
      })
      .catch((err) => setLocalError(err.message));

    return () => {
      if (autocompleteRef.current) {
        window.google?.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, []);

  const hasError = fieldError || localError;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30 ${
          hasError ? "border-red-300 bg-red-50" : "border-slate-200"
        } ${!ready && GMAPS_KEY ? "opacity-70" : ""}`}
        placeholder={ready ? placeholder : "Cargando búsqueda..."}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete="off"
      />
      {!GMAPS_KEY && (
        <div className="mt-1 text-[10px] text-amber-600">
          ⚠️ Google Maps no configurado — usando búsqueda básica
        </div>
      )}
      {fieldError && <p className="mt-1 text-[10px] text-red-600">{fieldError}</p>}
    </div>
  );
}
