import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createId } from "../lib/id.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const DB_PATH    = join(__dirname, "../../db.json");

export const workflow = [
  "Pendiente de cotizacion",
  "Cotizado",
  "Aceptado por cliente",
  "Agendado",
  "Asignado a camion / chofer",
  "En preparacion",
  "En ruta",
  "Entregado",
];

export const incidentStatus = "No conforme / incidencia";

const users = [
  {
    id: "usr-super-admin",
    name: "Juandaniel Aguilar",
    email: "Juandaniel.aguilar17@gmail.com",
    password: "19109364Daniel",
    role: "super_admin",
  },
];

// ─── Default seed data ────────────────────────────────────────────────────────
const DEFAULT_TRUCKS = [
  {
    id: "trk-01",
    name: "Camion 1",
    plate: "LTKF-21",
    maxWeightKg: 1500,
    maxPackages: 80,
    driverName: "Daniel Aguilar",
    driverPhone: "+56 9 1111 1111",
    status: "Disponible",
  },
  {
    id: "trk-02",
    name: "Camion 2",
    plate: "PHKZ-88",
    maxWeightKg: 3000,
    maxPackages: 140,
    driverName: "Chofer por asignar",
    driverPhone: "+56 9 2222 2222",
    status: "Disponible",
  },
  {
    id: "trk-03",
    name: "Camion 3",
    plate: "TRSA-41",
    maxWeightKg: 5000,
    maxPackages: 220,
    driverName: "Chofer eventual",
    driverPhone: "+56 9 3333 3333",
    status: "Mantencion",
  },
];

const DEFAULT_REQUESTS = [
  {
    id: "SOL-1001",
    trackingCode: "DRP-1001",
    source: "formulario_cliente",
    customerName: "Comercial Los Aromos",
    contactPerson: "Valentina Rojas",
    contactPhone: "+56 9 4444 1200",
    contactEmail: "valentina@losaromos.cl",
    pickupAddress: "Av. Irarrazaval 2401, Nunoa",
    deliveryAddress: "Av. Apoquindo 4501, Las Condes",
    destinationCity: "Las Condes",
    packages: 18,
    estimatedWeightKg: 420,
    cargoDescription: "Cajas selladas de productos comerciales",
    requiredDate: "2026-05-03",
    observations: "Retiro por estacionamiento subterraneo",
    status: "Pendiente de cotizacion",
    quotedAmount: null,
    serviceType: "",
    internalNotes: "",
    truckId: null,
    truckName: "",
    driverName: "",
    routeId: null,
    hasIncident: false,
    incidentDescription: "",
    createdAt: "2026-04-30T09:00:00.000Z",
    updatedAt: "2026-04-30T09:00:00.000Z",
    approximateLocation: "Solicitud recibida",
    photos: [],
    bultosDetail: [],
    avionetaCount: 0,
  },
  {
    id: "SOL-1002",
    trackingCode: "DRP-1002",
    source: "excel",
    customerName: "Carga Importada Santiago",
    contactPerson: "Mauricio Vega",
    contactPhone: "+56 9 5555 4455",
    contactEmail: "operaciones@cargaimportada.cl",
    pickupAddress: "Nunoa, Santiago",
    deliveryAddress: "Camino El Alba 11969, Las Condes",
    destinationCity: "Las Condes",
    packages: 32,
    estimatedWeightKg: 950,
    cargoDescription: "Bultos medianos para entrega comercial",
    requiredDate: "2026-05-04",
    observations: "Requiere dos personas para descarga",
    status: "Cotizado",
    quotedAmount: 78000,
    serviceType: "Flete urbano programado",
    internalNotes: "Cliente recurrente, confirmar horario temprano",
    truckId: null,
    truckName: "",
    driverName: "",
    routeId: null,
    hasIncident: false,
    incidentDescription: "",
    createdAt: "2026-04-30T10:10:00.000Z",
    updatedAt: "2026-04-30T10:40:00.000Z",
    approximateLocation: "Cotizacion enviada",
    photos: [],
    bultosDetail: [],
    avionetaCount: 0,
  },
];

// ─── Mutable arrays — loaded from db.json on startup, else seeded ─────────────
const trucks        = [...DEFAULT_TRUCKS];
const requests      = [...DEFAULT_REQUESTS];
const routes        = [];
const notifications = [];
const media         = { loginCarousel: [], marketingCarousel: [], logoUrl: "/dropit-logo.jpeg", companyName: "DropIt Service" };

const pricing = {
  baseFare: 12000,
  pricePerKm: 950,
  cargoSurcharge: { liviana: 0, media: 4500, pesada: 9000 },
};

// ─── Load persisted state from db.json ────────────────────────────────────────
if (existsSync(DB_PATH)) {
  try {
    const json = JSON.parse(readFileSync(DB_PATH, "utf8"));
    if (Array.isArray(json.requests) && json.requests.length > 0) {
      requests.length = 0;
      requests.push(...json.requests);
    }
    if (Array.isArray(json.trucks) && json.trucks.length > 0) {
      trucks.length = 0;
      trucks.push(...json.trucks);
    }
    if (Array.isArray(json.routes)) {
      routes.length = 0;
      routes.push(...json.routes);
    }
    if (json.media && typeof json.media === "object") {
      Object.assign(media, json.media);
    }
    console.log(`✅ db.json cargado: ${requests.length} solicitudes, ${routes.length} rutas`);
  } catch (e) {
    console.warn("⚠ No se pudo cargar db.json:", e.message);
  }
} else {
  console.log("📂 Sin db.json previo — usando datos de ejemplo");
}

export const store = {
  pricing,
  users,
  trucks,
  requests,
  routes,
  notifications,
  media,
};

// ─── Persist current state to db.json ─────────────────────────────────────────
export function saveStore() {
  try {
    writeFileSync(
      DB_PATH,
      JSON.stringify({ requests: store.requests, trucks: store.trucks, routes: store.routes, media: store.media }, null, 2),
      "utf8"
    );
  } catch (e) {
    console.warn("⚠ No se pudo guardar db.json:", e.message);
  }
}

// ─── Reference generators ─────────────────────────────────────────────────────
export function nextReference() {
  const maxNum = store.requests.reduce((max, r) => {
    const n = parseInt((r.id || "").replace(/\D/g, ""), 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 1000);
  return `SOL-${maxNum + 1}`;
}

export function nextTrackingCode() {
  const maxNum = store.requests.reduce((max, r) => {
    const n = parseInt((r.trackingCode || "").replace(/\D/g, ""), 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 1000);
  return `DRP-${maxNum + 1}`;
}

export function nextRouteCode() {
  const maxNum = store.routes.reduce((max, r) => {
    const n = parseInt((r.id || "").replace(/\D/g, ""), 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 1000);
  return `RUT-${maxNum + 1}`;
}

export function createRouteId() {
  return createId("route");
}
