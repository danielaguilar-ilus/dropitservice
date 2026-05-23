/**
 * StreetAutocomplete — dirección chilena con autocompletar
 *
 * Prioridad: Google Places API (si VITE_GOOGLE_MAPS_API_KEY está configurado)
 * Fallback: Photon (Komoot) + Nominatim en paralelo (gratuito, sin API key).
 *
 * Props:
 *   value          → string controlado (lo que se muestra en el input)
 *   onChange(text) → actualiza el string
 *   onComunaChange(comuna) → (opcional) llamado cuando se detecta comuna
 *   onCoordsChange({lat,lng}|null) → (opcional) llamado con coordenadas al seleccionar
 *   placeholder    → texto placeholder
 *   inputClassName → clases CSS adicionales para el <input>
 *   dotColor       → color del punto indicador (default "#F97316")
 *   required       → atributo required nativo
 *   disabled       → deshabilita el campo
 */

import { useState, useEffect, useRef } from "react";
import { MapPin, Search, X, Loader2 } from "lucide-react";
import { loadGoogleMaps } from "./GoogleMap";
import { COMUNAS } from "../lib/comunas";

// ─── Photon (Komoot) — rápido, sesgado hacia Santiago ─────────────────────────
async function photonSearch(q) {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q + ", Chile")}&limit=6&lat=-33.45&lon=-70.65`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.features || []).map(f => {
    const p = f.properties || {};
    const [lng, lat] = f.geometry?.coordinates || [0, 0];
    const street = [p.street, p.housenumber].filter(Boolean).join(" ") || p.name || "";
    const rawCity = p.city || p.district || p.locality || p.county || "";
    const commune = COMUNAS.find(c => c.toLowerCase() === rawCity.toLowerCase())
                 || COMUNAS.find(c => rawCity.toLowerCase().includes(c.toLowerCase()))
                 || rawCity;
    const subtext = [rawCity, p.state, "Chile"].filter(Boolean).slice(0, 2).join(", ");
    return { street, commune, subtext, raw: rawCity, lat, lng };
  });
}

// ─── Nominatim — fallback estructurado ────────────────────────────────────────
async function nominatimSearch(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=cl&addressdetails=1&limit=7&accept-language=es`;
  const res = await fetch(url, { headers: { "Accept-Language": "es" } });
  return res.json();
}

function parseNominatim(result) {
  const a       = result.address || {};
  const num     = a.house_number || "";
  const road    = a.road || a.pedestrian || a.footway || a.cycleway || a.path || "";
  const rawCity = a.city_district || a.suburb || a.quarter || a.city || a.town || a.village || a.municipality || "";
  const commune = COMUNAS.find(c => c.toLowerCase() === rawCity.toLowerCase())
               || COMUNAS.find(c => rawCity.toLowerCase().includes(c.toLowerCase()))
               || rawCity;
  const street  = road ? [road, num].filter(Boolean).join(" ") : result.display_name.split(",")[0].trim();
  const subtext = [rawCity, a.county, a.state].filter(Boolean).slice(0, 2).join(", ");
  const lat = parseFloat(result.lat);
  const lng = parseFloat(result.lon);
  return { street, commune, subtext, raw: rawCity, lat, lng };
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

// Photon + Nominatim en paralelo, deduplicado
async function multiSearch(q) {
  const [photon, nominatim] = await Promise.allSettled([
    withTimeout(photonSearch(q), 4000),
    withTimeout(nominatimSearch(q).then(d => d.map(parseNominatim)), 5000),
  ]);
  const photonResults    = photon.status    === "fulfilled" ? photon.value    : [];
  const nominatimResults = nominatim.status === "fulfilled" ? nominatim.value : [];
  const combined = [...photonResults, ...nominatimResults];
  const seen = new Set();
  return combined.filter(r => {
    const k = `${r.street}|${r.commune}`.toLowerCase();
    if (seen.has(k) || !r.street) return false;
    seen.add(k);
    return true;
  }).slice(0, 7);
}

// Extrae la comuna desde los componentes de dirección de Google
function extractGoogleCommune(components = []) {
  const raw =
    components.find(c => c.types.includes("locality"))?.long_name ||
    components.find(c => c.types.includes("sublocality_level_1"))?.long_name ||
    components.find(c => c.types.includes("administrative_area_level_3"))?.long_name ||
    "";
  return (
    COMUNAS.find(c => c.toLowerCase() === raw.toLowerCase()) ||
    COMUNAS.find(c => raw.toLowerCase().includes(c.toLowerCase())) ||
    raw
  );
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function StreetAutocomplete({
  value,
  onChange,
  onComunaChange,
  onCoordsChange,
  placeholder = "Dirección…",
  inputClassName = "",
  dotColor = "#F97316",
  required = false,
  disabled = false,
}) {
  const [open,         setOpen]    = useState(false);
  const [results,      setResults] = useState([]);
  const [loading,      setLoading] = useState(false);
  const [usingGoogle,  setGoogle]  = useState(false);
  // tracks whether the *current* visible results came from Google Places (not just SDK loaded)
  const [resultsFromGoogle, setResultsFromGoogle] = useState(false);
  const debRef    = useRef(null);
  const gmRef     = useRef(null);
  const wrapRef   = useRef(null);
  const cancelRef = useRef(false);

  // Carga el SDK de Google Maps al montar
  useEffect(() => {
    cancelRef.current = false;
    loadGoogleMaps()
      .then(gm => {
        if (cancelRef.current) return;
        gmRef.current = gm;
        setGoogle(true);
      })
      .catch(() => {});
    return () => { cancelRef.current = true; };
  }, []);

  // Cierra el dropdown al hacer clic fuera
  useEffect(() => {
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function handleChange(e) {
    const val = e.target.value;
    onChange(val);
    onCoordsChange?.(null);
    clearTimeout(debRef.current);
    if (val.trim().length < 3) { setResults([]); setOpen(false); return; }

    debRef.current = setTimeout(() => {
      setLoading(true);
      const gm = gmRef.current || window.google?.maps;

      if (gm?.places?.AutocompleteService) {
        // ── Google Places ────────────────────────────────────────────────────
        new gm.places.AutocompleteService().getPlacePredictions(
          { input: val, componentRestrictions: { country: "cl" }, types: ["address"] },
          (preds, status) => {
            if (cancelRef.current) return;
            setLoading(false);
            if (status !== gm.places.PlacesServiceStatus.OK || !preds) {
              setResults([]); setOpen(false); setResultsFromGoogle(false); return;
            }
            setResults(preds.map(p => ({
              placeId:  p.place_id,
              label:    p.structured_formatting.main_text,
              sublabel: p.structured_formatting.secondary_text || "",
              full:     p.description,
            })));
            setResultsFromGoogle(true);
            setOpen(true);
          }
        );
      } else {
        // ── Photon + Nominatim ───────────────────────────────────────────────
        multiSearch(val).then(parsed => {
          if (cancelRef.current) return;
          const items = parsed.map(p => ({
            label:    p.street,
            sublabel: [p.commune, "Chile"].filter(Boolean).join(", "),
            commune:  p.commune,
            lat: p.lat, lng: p.lng,
          }));
          setResults(items);
          setResultsFromGoogle(false);
          setOpen(items.length > 0);
          setLoading(false);
        }).catch(() => { if (!cancelRef.current) setLoading(false); });
      }
    }, 280);
  }

  function select(item) {
    const gm = gmRef.current || window.google?.maps;
    setResults([]); setOpen(false);

    if (item.placeId && gm) {
      // Muestra el label inmediato, geocodifica en background para coords+comuna
      onChange(item.label + (item.sublabel ? ", " + item.sublabel.split(",")[0] : ""));
      new gm.Geocoder().geocode({ placeId: item.placeId }, (res, status) => {
        if (status !== "OK" || !res[0]) return;
        const loc = res[0].geometry.location;
        onCoordsChange?.({ lat: loc.lat(), lng: loc.lng() });
        onComunaChange?.(extractGoogleCommune(res[0].address_components));
      });
    } else {
      onChange(item.label + (item.sublabel ? ", " + item.sublabel : ""));
      if (item.commune) onComunaChange?.(item.commune);
      if (!isNaN(item.lat)) onCoordsChange?.({ lat: item.lat, lng: item.lng });
    }
  }

  function clear() {
    onChange("");
    onComunaChange?.("");
    onCoordsChange?.(null);
    setResults([]); setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      {/* Input */}
      <div className="relative flex items-center">
        <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
          <div
            className="h-2.5 w-2.5 rounded-full border-2"
            style={{ borderColor: dotColor, backgroundColor: "#fff" }}
          />
        </div>
        <input
          className={`w-full rounded-xl border border-slate-200 bg-white py-3 pl-8 pr-9 text-sm text-slate-800 placeholder-slate-400 shadow-sm transition focus:border-dropit-accent focus:outline-none focus:ring-2 focus:ring-dropit-accent/20 disabled:opacity-50 disabled:cursor-not-allowed ${inputClassName}`}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          autoComplete="off"
          inputMode="text"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          required={required}
          disabled={disabled}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {loading ? (
            <Loader2 size={14} className="animate-spin text-slate-400" />
          ) : value ? (
            <button type="button" onClick={clear} disabled={disabled}>
              <X size={14} className="text-slate-300 hover:text-slate-500" />
            </button>
          ) : (
            <Search size={14} className="text-slate-300" />
          )}
        </div>
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <ul className="absolute z-[9999] mt-1.5 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {results.map((r, i) => (
            <li
              key={i}
              onMouseDown={() => select(r)}
              className="flex cursor-pointer items-center gap-3 border-b border-slate-50 px-4 py-3 last:border-0 hover:bg-slate-50 transition-colors"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100">
                <MapPin size={14} className="text-slate-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{r.label}</p>
                <p className="truncate text-xs text-slate-400">{r.sublabel}</p>
              </div>
            </li>
          ))}
          <li className="flex items-center justify-end bg-white px-4 py-2">
            {resultsFromGoogle ? (
              <img
                src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png"
                alt="Powered by Google"
                className="h-4 object-contain"
              />
            ) : (
              <span className="text-[9px] text-slate-400">© OpenStreetMap contributors</span>
            )}
          </li>
        </ul>
      )}
    </div>
  );
}
