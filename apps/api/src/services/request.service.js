import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  incidentStatus,
  nextReference,
  nextRouteCode,
  nextTrackingCode,
  saveStore,
  store,
} from "../data/store.js";
import { notify } from "./notification.service.js";
import { uploadImage, isCloudinaryConfigured } from "./cloudinary.service.js";

// ─── Photo persistence helpers ────────────────────────────────────────────────
// Uploads photos to Cloudinary if configured, otherwise saves locally.
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const UPLOADS_DIR = join(__dirname, "../../uploads");

function ensureUploadsDir() {
  if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });
}

async function persistPhoto(dataUrl, requestId, idx) {
  if (typeof dataUrl !== "string") return null;
  if (!dataUrl.startsWith("data:")) return dataUrl; // already a URL — keep as-is

  try {
    const result = await uploadImage(dataUrl, {
      folder: "dropit/quotes",
      publicId: `quote-${requestId}-${idx + 1}`,
    });
    return result.url;
  } catch (err) {
    console.warn(`⚠️ Photo upload failed for ${requestId}-${idx}:`, err.message);
    // Local fallback
    const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) return null;
    const ext  = match[1] === "jpeg" ? "jpg" : match[1];
    const buf  = Buffer.from(match[2], "base64");
    const name = `quote-${requestId}-${idx + 1}.${ext}`;
    ensureUploadsDir();
    writeFileSync(join(UPLOADS_DIR, name), buf);
    return `/uploads/${name}`;
  }
}

async function persistPhotos(photos, requestId) {
  if (!Array.isArray(photos) || photos.length === 0) return [];
  const results = await Promise.allSettled(
    photos.map((p, i) => persistPhoto(p, requestId, i))
  );
  return results
    .filter(r => r.status === "fulfilled" && r.value)
    .map(r => r.value);
}

const requiredImportFields = [
  "referenceId",
  "contactPerson",
  "fullAddress",
  "destinationCity",
  "packages",
  "contactPhone",
  "contactEmail",
  "weight",
];

export async function createQuoteRequest(payload) {
  const now = new Date().toISOString();
  const requestId = nextReference();
  // Upload photos to Cloudinary (or local fallback) before storing in db.json
  const photoUrls = await persistPhotos(payload.photos, requestId);
  const request = {
    id: requestId,
    trackingCode: nextTrackingCode(),
    source: "formulario_cliente",
    customerName: payload.customerName,
    contactPerson: payload.contactPerson,
    contactPhone: payload.contactPhone,
    contactEmail: payload.contactEmail,
    pickupAddress: payload.pickupAddress,
    deliveryAddress: payload.deliveryAddress,
    destinationCity: payload.destinationCity,
    packages: Number(payload.packages || 0),
    estimatedWeightKg: Number(payload.estimatedWeightKg || 0),
    cargoDescription: payload.cargoDescription,
    requiredDate: payload.requiredDate,
    requiredTime: payload.requiredTime || "",
    distanceKm: payload.distanceKm || null,
    estimatedPrice: payload.estimatedPrice || null,
    avioneta: payload.avioneta || false,
    avionetaCount: Number(payload.avionetaCount || 0),
    photos: photoUrls,
    bultosDetail: Array.isArray(payload.bultosDetail) ? payload.bultosDetail : [],
    urgent: payload.urgent || false,
    observations: payload.observations || "",
    emailSent: false,
    whatsappSent: false,
    remindersSent: [],
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
    createdAt: now,
    updatedAt: now,
    approximateLocation: "Solicitud recibida",
  };

  store.requests.unshift(request);
  saveStore();
  notify({ type: "quote_received", to: request.contactEmail, requestId: request.id });
  notify({ type: "quote_internal", to: "admin@dropit.local", requestId: request.id });
  return request;
}

export function quoteRequest(requestId, payload) {
  const request = store.requests.find((item) => item.id === requestId);
  if (!request) {
    throw new Error("Solicitud no encontrada");
  }

  request.quotedAmount = Number(payload.quotedAmount);
  request.serviceType = payload.serviceType;
  request.internalNotes = payload.internalNotes || "";
  request.status = "Cotizado";
  request.emailSent = true;
  request.updatedAt = new Date().toISOString();
  request.approximateLocation = "Cotizacion enviada";
  saveStore();

  notify({
    type: "quote_sent",
    to: request.contactEmail,
    requestId: request.id,
    payload: {
      amount: request.quotedAmount,
      serviceType: request.serviceType,
    },
  });

  return request;
}

export function updateRequestStatus(requestId, status, incidentDescription = "") {
  const request = store.requests.find((item) => item.id === requestId);
  if (!request) {
    throw new Error("Pedido no encontrado");
  }

  request.status = status;
  request.updatedAt = new Date().toISOString();
  request.approximateLocation = status;
  saveStore();

  if (status === incidentStatus) {
    request.hasIncident = true;
    request.incidentDescription = incidentDescription || "Incidencia registrada";
    notify({ type: "order_incident", to: request.contactEmail, requestId: request.id });
    return request;
  }

  const notificationByStatus = {
    Agendado: "order_scheduled",
    "En preparacion": "order_preparing",
    "En ruta": "order_on_route",
    Entregado: "order_delivered",
  };

  if (notificationByStatus[status]) {
    notify({ type: notificationByStatus[status], to: request.contactEmail, requestId: request.id });
  }

  return request;
}

export function validateImportRows(rows) {
  const errors = [];

  rows.forEach((row, index) => {
    requiredImportFields.forEach((field) => {
      if (!row[field]) {
        errors.push({
          row: index + 1,
          field,
          message: `Falta ${field}`,
        });
      }
    });
  });

  return errors;
}

export function importOrders(rows) {
  const errors = validateImportRows(rows);
  if (errors.length > 0) {
    return {
      imported: [],
      errors,
    };
  }

  const now = new Date().toISOString();
  const imported = rows.map((row) => {
    const request = {
      id: row.referenceId || nextReference(),
      trackingCode: row.trackingCode || nextTrackingCode(),
      source: "excel",
      customerName: row.customerName || row.contactPerson,
      contactPerson: row.contactPerson,
      contactPhone: row.contactPhone,
      contactEmail: row.contactEmail,
      pickupAddress: row.pickupAddress || "Nunoa, Santiago de Chile",
      deliveryAddress: row.fullAddress,
      destinationCity: row.destinationCity,
      packages: Number(row.packages || 0),
      estimatedWeightKg: Number(row.weight || 0),
      cargoDescription: row.skills || "Pedido importado por Excel",
      requiredDate: row.requiredDate || "",
      observations: row.observations || "",
      status: "Aceptado por cliente",
      quotedAmount: row.cost ? Number(row.cost) : null,
      serviceType: row.serviceType || "Pedido importado",
      internalNotes: "Creado desde carga masiva",
      truckId: null,
      truckName: "",
      driverName: "",
      routeId: null,
      hasIncident: false,
      incidentDescription: "",
      createdAt: now,
      updatedAt: now,
      approximateLocation: "Disponible para planificacion",
    };

    store.requests.unshift(request);
    return request;
  });

  saveStore();
  return {
    imported,
    errors: [],
  };
}

export function createRoutePlan(payload) {
  const truck = store.trucks.find((item) => item.id === payload.truckId);
  if (!truck) {
    throw new Error("Camion no encontrado");
  }

  const selected = payload.requestIds
    .map((id) => store.requests.find((request) => request.id === id))
    .filter(Boolean);

  if (selected.length === 0) {
    throw new Error("Selecciona al menos un pedido");
  }

  const route = {
    id: nextRouteCode(),
    name: payload.name || `Ruta ${nextRouteCode()}`,
    requestIds: selected.map((item) => item.id),
    orderedRequestIds: payload.orderedRequestIds?.length ? payload.orderedRequestIds : selected.map((item) => item.id),
    truckId: truck.id,
    truckName: truck.name,
    driverName: payload.driverName || truck.driverName,
    driverPhone: payload.driverPhone || truck.driverPhone,
    status: payload.startRoute ? "En ruta" : "Agendado",
    plannedDate: payload.plannedDate,
    optimizationMode: payload.optimizationMode || "visual_manual",
    createdAt: new Date().toISOString(),
  };

  store.routes.unshift(route);
  truck.status = payload.startRoute ? "En ruta" : "Disponible";
  saveStore();

  selected.forEach((request) => {
    request.routeId = route.id;
    request.truckId = truck.id;
    request.truckName = truck.name;
    request.driverName = route.driverName;
    updateRequestStatus(request.id, payload.startRoute ? "En ruta" : "Agendado");
  });

  return route;
}
