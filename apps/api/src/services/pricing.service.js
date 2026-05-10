import { store } from "../data/store.js";

export function buildAutomaticQuote(payload, route) {
  const cargoSurcharge = store.pricing.cargoSurcharge[payload.cargoType] || 0;
  const quantityFactor = Number(payload.quantity || 1) > 1 ? (Number(payload.quantity) - 1) * 1200 : 0;
  const volumeFactor = payload.volume ? Number(payload.volume) * 350 : 0;
  const distanceComponent = route.distanceKm * store.pricing.pricePerKm;
  const price = Math.round(
    store.pricing.baseFare + distanceComponent + cargoSurcharge + quantityFactor + volumeFactor
  );

  return {
    mode: "automatic",
    customerName: payload.customerName,
    customerPhone: payload.customerPhone,
    origin: payload.origin,
    destination: payload.destination,
    cargoType: payload.cargoType,
    quantity: Number(payload.quantity || 1),
    volume: payload.volume || null,
    price,
    distanceKm: route.distanceKm,
    durationMinutes: route.durationMinutes,
    route,
    breakdown: {
      baseFare: store.pricing.baseFare,
      distanceComponent,
      cargoSurcharge,
      quantityFactor,
      volumeFactor,
    },
  };
}

export function buildManualQuote(payload, route) {
  return {
    mode: "manual",
    customerName: payload.customerName,
    customerPhone: payload.customerPhone,
    origin: "Nunoa, Santiago de Chile",
    destination: payload.destination,
    cargoType: payload.cargoType,
    price: Number(payload.directPrice),
    description: payload.description,
    specialConditions: payload.specialConditions || "",
    distanceKm: route.distanceKm,
    durationMinutes: route.durationMinutes,
    route,
    breakdown: {
      manualPrice: Number(payload.directPrice),
    },
  };
}
