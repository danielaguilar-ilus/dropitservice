const communeCoordinates = {
  "nunoa": { lat: -33.4569, lng: -70.5979, label: "Nunoa, Santiago de Chile" },
  "santiago": { lat: -33.4489, lng: -70.6693, label: "Santiago Centro, Chile" },
  "providencia": { lat: -33.4263, lng: -70.6167, label: "Providencia, Chile" },
  "las condes": { lat: -33.4085, lng: -70.5672, label: "Las Condes, Chile" },
  "la reina": { lat: -33.4418, lng: -70.5477, label: "La Reina, Chile" },
  "penalolen": { lat: -33.4855, lng: -70.5361, label: "Penalolen, Chile" },
  "macul": { lat: -33.4873, lng: -70.5966, label: "Macul, Chile" },
  "san joaquin": { lat: -33.4974, lng: -70.6164, label: "San Joaquin, Chile" },
  "maipu": { lat: -33.5109, lng: -70.7564, label: "Maipu, Chile" },
  "puente alto": { lat: -33.6117, lng: -70.5753, label: "Puente Alto, Chile" },
};

function normalize(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function resolveCoordinate(address) {
  const normalized = normalize(address);

  for (const [key, value] of Object.entries(communeCoordinates)) {
    if (normalized.includes(key)) {
      return {
        ...value,
        label: address,
      };
    }
  }

  const hash = Array.from(normalized).reduce((acc, char) => acc + char.charCodeAt(0), 0);

  return {
    lat: -33.45 + ((hash % 15) - 7) * 0.01,
    lng: -70.61 + ((hash % 21) - 10) * 0.01,
    label: address,
  };
}

export function haversineKm(origin, destination) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(destination.lat - origin.lat);
  const dLng = toRad(destination.lng - origin.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(origin.lat)) *
      Math.cos(toRad(destination.lat)) *
      Math.sin(dLng / 2) ** 2;

  return Number((earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
}
