/**
 * StreetAutocomplete — dirección chilena con autocompletar
 *
 * Prioridad: Google Places API (si VITE_GOOGLE_MAPS_API_KEY está configurado)
 * Fallback: Photon (Komoot) + Nominatim en paralelo (gratuito, sin API key).
 * Si Google devuelve REQUEST_DENIED o cualquier error, se cae permanentemente
 * a OSM durante la sesión (googleDisabledRef) sin bloquear el input.
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

// ─── Comunas de la Región Metropolitana para priorizar resultados urbanos ─────
const RM_COMUNAS = new Set([
  "Santiago", "Providencia", "Las Condes", "Vitacura", "Lo Barnechea",
  "Ñuñoa", "La Reina", "Peñalolén", "Macul", "San Joaquín", "La Florida",
  "La Pintana", "El Bosque", "Pedro Aguirre Cerda", "San Miguel", "San Ramón",
  "Lo Espejo", "Estación Central", "Cerrillos", "Maipú", "Pudahuel",
  "Quinta Normal", "Cerro Navia", "Lo Prado", "Renca", "Conchalí",
  "Huechuraba", "Recoleta", "Independencia", "Quilicura", "Colina",
  "Lampa", "Tiltil", "Puente Alto", "Pirque", "San José de Maipo",
  "San Bernardo", "Buin", "Paine", "Calera de Tango", "Talagante",
  "El Monte", "Isla de Maipo", "Peñaflor", "Padre Hurtado", "Melipilla",
  "Curacaví", "María Pinto", "San Pedro", "Alhué", "Buín",
]);

// ─── Normalización para dedup (sin acentos, lowercase, solo alfanumérico) ─────
function normalizeKey(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Detecta si el query parece urbano (corto, sin ciudad explícita foránea) ──
function looksUrban(q) {
  return q.trim().split(/\s+/).length <= 5;
}

// ─── Photon (Komoot) — sesgado a Santiago ─────────────────────────────────────
async function photonSearchSantiago(q) {
  // Con sesgo geográfico a Santiago + filtro de tipos viales
  const tagFilter =
    "&osm_tag=highway:residential&osm_tag=highway:primary&osm_tag=highway:secondary" +
    "&osm_tag=highway:tertiary&osm_tag=highway:unclassified";
  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q + ", Chile")}` +
    `&limit=8&lat=-33.45&lon=-70.65&location_bias_scale=0.5${tagFilter}`;
  const res = await fetch(url);
  const data = await res.json();
  const features = data.features || [];

  // Si devuelve menos de 3 resultados, reintenta sin filtro osm_tag
  if (features.length < 3) {
    const url2 =
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q + ", Chile")}` +
      `&limit=8&lat=-33.45&lon=-70.65&location_bias_scale=0.5`;
    const res2 = await fetch(url2);
    const data2 = await res2.json();
    return parsePhotonFeatures(data2.features || []);
  }
  return parsePhotonFeatures(features);
}

// ─── Photon sin sesgo geográfico — cubre regiones ─────────────────────────────
async function photonSearchNational(q) {
  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q + ", Chile")}` +
    `&limit=6`;
  const res = await fetch(url);
  const data = await res.json();
  return parsePhotonFeatures(data.features || []);
}

function parsePhotonFeatures(features) {
  return features.map(f => {
    const p = f.properties || {};
    const [lng, lat] = f.geometry?.coordinates || [0, 0];
    const street =
      [p.street, p.housenumber].filter(Boolean).join(" ") ||
      p.name ||
      "";
    const rawCity =
      p.city || p.district || p.locality || p.county || "";
    const commune =
      COMUNAS.find(c => c.toLowerCase() === rawCity.toLowerCase()) ||
      COMUNAS.find(c => rawCity.toLowerCase().includes(c.toLowerCase())) ||
      rawCity;
    const subtext = [rawCity, p.state, "Chile"].filter(Boolean).slice(0, 2).join(", ");
    const hasNumber = Boolean(p.housenumber);
    const inRM = RM_COMUNAS.has(commune) || RM_COMUNAS.has(rawCity);
    return { street, commune, subtext, raw: rawCity, lat, lng, hasNumber, inRM, source: "photon" };
  }).filter(r => r.street);
}

// ─── Nominatim — estructurado, dedupe, por calle ──────────────────────────────
async function nominatimSearch(q) {
  // Separa número del nombre si el query lo incluye (ej. "Apoquindo 4775")
  const streetMatch = q.match(/^(.+?)\s+(\d{3,5})\s*$/);
  let url;
  if (streetMatch) {
    const streetName = streetMatch[1].trim();
    const houseNum   = streetMatch[2];
    url =
      `https://nominatim.openstreetmap.org/search?format=json` +
      `&street=${encodeURIComponent(streetName + " " + houseNum)}` +
      `&countrycodes=cl&addressdetails=1&limit=7&dedupe=1&accept-language=es`;
  } else {
    url =
      `https://nominatim.openstreetmap.org/search?format=json` +
      `&q=${encodeURIComponent(q)}` +
      `&countrycodes=cl&addressdetails=1&limit=7&featuretype=street&dedupe=1&accept-language=es`;
  }
  const res = await fetch(url, { headers: { "Accept-Language": "es" } });
  const data = await res.json();
  return data.map(parseNominatim);
}

function parseNominatim(result) {
  const a       = result.address || {};
  const num     = a.house_number || "";
  const road    = a.road || a.pedestrian || a.footway || a.cycleway || a.path || "";
  const rawCity = a.city_district || a.suburb || a.quarter || a.city || a.town || a.village || a.municipality || "";
  const commune =
    COMUNAS.find(c => c.toLowerCase() === rawCity.toLowerCase()) ||
    COMUNAS.find(c => rawCity.toLowerCase().includes(c.toLowerCase())) ||
    rawCity;
  const street  = road
    ? [road, num].filter(Boolean).join(" ")
    : result.display_name.split(",")[0].trim();
  const subtext = [rawCity, a.county, a.state].filter(Boolean).slice(0, 2).join(", ");
  const lat = parseFloat(result.lat);
  const lng = parseFloat(result.lon);
  const hasNumber = Boolean(num);
  const inRM = RM_COMUNAS.has(commune) || RM_COMUNAS.has(rawCity);
  return { street, commune, subtext, raw: rawCity, lat, lng, hasNumber, inRM, source: "nominatim" };
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

// ─── HERE Maps Geocoding (premium quality, 250k/mes gratis sin tarjeta) ───────
// Signup: https://platform.here.com (solo email, no requiere tarjeta)
// Variable: VITE_HERE_API_KEY
const HERE_KEY = import.meta.env.VITE_HERE_API_KEY || "";
// Module-level state: si HERE devuelve 401/403, lo deshabilitamos hasta refresh
const hereDisabledRef = { disabled: false };

async function hereAutocomplete(q) {
  if (!HERE_KEY) return [];
  // at=lat,lon sesga al Santiago RM. in=countryCode:CHL restringe a Chile.
  const url =
    `https://autosuggest.search.hereapi.com/v1/autosuggest` +
    `?at=-33.45,-70.65` +
    `&q=${encodeURIComponent(q)}` +
    `&in=countryCode:CHL` +
    `&types=address,street` +
    `&limit=8` +
    `&lang=es` +
    `&apiKey=${HERE_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      console.warn("[StreetAutocomplete] HERE Maps key inválida o sin permisos:", res.status);
      hereDisabledRef.disabled = true; // (objeto módulo-level, ver abajo)
    }
    return [];
  }
  const data = await res.json();
  return (data.items || []).map(item => {
    const addr = item.address || {};
    const street = [addr.street, addr.houseNumber].filter(Boolean).join(" ") || item.title || "";
    const rawCity = addr.district || addr.city || addr.county || "";
    const commune =
      COMUNAS.find(c => c.toLowerCase() === rawCity.toLowerCase()) ||
      COMUNAS.find(c => rawCity.toLowerCase().includes(c.toLowerCase())) ||
      rawCity;
    const subtext = [rawCity, addr.state || "", "Chile"].filter(Boolean).slice(0, 2).join(", ");
    const lat = item.position?.lat ?? item.access?.[0]?.lat;
    const lng = item.position?.lng ?? item.access?.[0]?.lng;
    const hasNumber = Boolean(addr.houseNumber);
    const inRM = RM_COMUNAS.has(commune) || RM_COMUNAS.has(rawCity);
    return { street, commune, subtext, raw: rawCity, lat, lng, hasNumber, inRM, source: "here" };
  }).filter(r => r.street);
}

// ─── multiSearch: HERE primero (si hay key), después OSM en paralelo ──────────
async function multiSearch(q) {
  const urban = looksUrban(q);
  const useHere = HERE_KEY && !hereDisabledRef.disabled;

  // 1) HERE — si está disponible, intenta primero (mejor cobertura Chile)
  let hereResults = [];
  if (useHere) {
    try {
      hereResults = await withTimeout(hereAutocomplete(q), 5000);
    } catch { hereResults = []; }
  }

  // 2) OSM (Photon Santiago + Photon CL + Nominatim) en paralelo
  //    Siempre se ejecutan para enriquecer / cubrir gaps de HERE
  const [photonSCL, photonCL, nominatim] = await Promise.allSettled([
    withTimeout(photonSearchSantiago(q), 5000),
    withTimeout(photonSearchNational(q), 5000),
    withTimeout(nominatimSearch(q), 6000),
  ]);

  const all = [
    ...hereResults, // HERE primero (mejor calidad)
    ...(photonSCL.status === "fulfilled" ? photonSCL.value : []),
    ...(photonCL.status  === "fulfilled" ? photonCL.value  : []),
    ...(nominatim.status === "fulfilled" ? nominatim.value : []),
  ];

  // Dedup por clave normalizada
  const seen = new Set();
  const deduped = all.filter(r => {
    const k = normalizeKey(`${r.street}|${r.commune}`);
    if (seen.has(k) || !r.street) return false;
    seen.add(k);
    return true;
  });

  // Ranking: HERE > con número > RM (si urbano) > resto
  deduped.sort((a, b) => {
    const scoreA = (a.source === "here" ? 4 : 0) + (a.hasNumber ? 2 : 0) + (urban && a.inRM ? 1 : 0);
    const scoreB = (b.source === "here" ? 4 : 0) + (b.hasNumber ? 2 : 0) + (urban && b.inRM ? 1 : 0);
    return scoreB - scoreA;
  });

  return deduped.slice(0, 7);
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
  const debRef           = useRef(null);
  const gmRef            = useRef(null);
  const wrapRef          = useRef(null);
  const cancelRef        = useRef(false);
  // Once Google returns REQUEST_DENIED / OVER_QUERY_LIMIT, we permanently
  // switch to OSM for the rest of the session — no more wasted round-trips.
  const googleDisabledRef = useRef(false);

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

      // Helper: cae a OSM (Photon + Nominatim) — usado tanto cuando no hay
      // Google como cuando Google falla (REQUEST_DENIED por billing, etc.)
      const fallbackToOSM = () => {
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
      };

      const canTryGoogle =
        !googleDisabledRef.current && gm?.places?.AutocompleteService;

      if (canTryGoogle) {
        // ── Google Places ────────────────────────────────────────────────────
        new gm.places.AutocompleteService().getPlacePredictions(
          { input: val, componentRestrictions: { country: "cl" }, types: ["address"] },
          (preds, status) => {
            if (cancelRef.current) return;
            const ok = gm.places.PlacesServiceStatus.OK;
            const denied = gm.places.PlacesServiceStatus.REQUEST_DENIED;
            const overLimit = gm.places.PlacesServiceStatus.OVER_QUERY_LIMIT;

            // Si Google nos baneó por billing/cuota, no volvemos a intentar
            if (status === denied || status === overLimit) {
              googleDisabledRef.current = true;
              console.warn(
                "[StreetAutocomplete] Google Places",
                status,
                "— cambiando a Photon/Nominatim para el resto de la sesión"
              );
            }

            // Cualquier status != OK o sin predicciones → fallback OSM
            if (status !== ok || !preds || preds.length === 0) {
              fallbackToOSM();
              return;
            }

            setLoading(false);
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
        // ── Sin Google (o ya deshabilitado) → directo a HERE + Photon + Nominatim ──
        fallbackToOSM();
      }
    }, 280);
  }

  // ¿Algún resultado vino de HERE? — afecta el badge del footer
  const hasHereResult = results.some(r => r.source === "here");

  function select(item) {
    const gm = gmRef.current || window.google?.maps;
    setResults([]); setOpen(false);

    if (item.placeId && gm) {
      // Muestra el label inmediato, resuelve coords+comuna en background.
      onChange(item.label + (item.sublabel ? ", " + item.sublabel.split(",")[0] : ""));
      // Usamos Places Details (NO la Geocoding API) para traer geometry +
      // address_components. Places ya está habilitado (el autocomplete funciona),
      // así no dependemos de habilitar Geocoding en el proyecto de Google.
      try {
        const svc = new gm.places.PlacesService(document.createElement("div"));
        svc.getDetails(
          { placeId: item.placeId, fields: ["geometry", "address_components", "formatted_address"] },
          (place, status) => {
            if (cancelRef.current) return;
            if (status !== gm.places.PlacesServiceStatus.OK || !place?.geometry) return;
            const loc = place.geometry.location;
            onCoordsChange?.({ lat: loc.lat(), lng: loc.lng() });
            onComunaChange?.(extractGoogleCommune(place.address_components));
          }
        );
      } catch {
        /* Si Places Details falla, al menos la dirección queda escrita en el input. */
      }
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
          className={`w-full rounded-xl border border-slate-200 bg-white py-3 pl-8 pr-9 text-base sm:text-sm text-slate-800 placeholder-slate-400 shadow-sm transition focus:border-dropit-accent focus:outline-none focus:ring-2 focus:ring-dropit-accent/20 disabled:opacity-50 disabled:cursor-not-allowed ${inputClassName}`}
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
            ) : hasHereResult ? (
              <span className="text-[10px] font-semibold text-slate-500">
                Sugerencias por <span className="text-[#48DAD0]">HERE Maps</span>
              </span>
            ) : (
              <span className="text-[9px] text-slate-400">© OpenStreetMap contributors</span>
            )}
          </li>
        </ul>
      )}
    </div>
  );
}
