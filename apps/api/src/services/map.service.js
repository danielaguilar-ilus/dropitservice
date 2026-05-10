import { env } from "../config/env.js";
import { haversineKm, resolveCoordinate } from "../lib/geo.js";

async function geocodeWithMapbox(address) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    address
  )}.json?limit=1&country=CL&access_token=${env.mapboxToken}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("No fue posible geocodificar la direccion");
  }

  const data = await response.json();
  const feature = data.features?.[0];

  if (!feature) {
    throw new Error("Direccion sin resultados");
  }

  return {
    lat: feature.center[1],
    lng: feature.center[0],
    label: feature.place_name_es || feature.place_name || address,
  };
}

async function directionsWithMapbox(origin, destination) {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?geometries=geojson&overview=simplified&access_token=${env.mapboxToken}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("No fue posible calcular la ruta");
  }

  const data = await response.json();
  const route = data.routes?.[0];

  if (!route) {
    throw new Error("Ruta no disponible");
  }

  return {
    distanceKm: Number((route.distance / 1000).toFixed(1)),
    durationMinutes: Math.max(10, Math.round(route.duration / 60)),
    geometry: route.geometry,
  };
}

export async function estimateRoute(originAddress, destinationAddress) {
  if (env.mapboxToken) {
    try {
      const origin = await geocodeWithMapbox(originAddress);
      const destination = await geocodeWithMapbox(destinationAddress);
      const route = await directionsWithMapbox(origin, destination);

      return {
        origin,
        destination,
        distanceKm: route.distanceKm,
        durationMinutes: route.durationMinutes,
        geometry: route.geometry,
      };
    } catch {
      // fallback local below
    }
  }

  const origin = resolveCoordinate(originAddress);
  const destination = resolveCoordinate(destinationAddress);
  const distanceKm = haversineKm(origin, destination);

  return {
    origin,
    destination,
    distanceKm,
    durationMinutes: Math.max(12, Math.round(distanceKm * 3.6)),
    geometry: null,
  };
}
