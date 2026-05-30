import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import {
  incidentStatus,
  nextReference,
  nextRouteCode,
  nextTrackingCode,
  saveStore,
  store,
} from "../data/store.js";
import * as db from "../data/db.js";
import { notify } from "./notification.service.js";
import { uploadImage, isCloudinaryConfigured } from "./cloudinary.service.js";

// ─── Dual-path guard ─────────────────────────────────────────────────────────
// Cuando DATABASE_URL está set, usamos Postgres; si no, fallback a store.js + db.json.
const HAS_DB = !!process.env.DATABASE_URL;

// ─── Photo persistence helpers ────────────────────────────────────────────────
// Uploads photos to Cloudinary if configured, otherwise saves locally.
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
// DATA_DIR keeps uploads co-located with db.json on the Railway Volume.
// Falls back to apps/api/uploads (same behaviour as before) when not set.
const UPLOADS_DIR = join(process.env.DATA_DIR || join(__dirname, "../.."), "uploads");

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
  const requestId    = HAS_DB ? await db.nextRequestId()    : nextReference();
  const trackingCode = HAS_DB ? await db.nextTrackingCode() : nextTrackingCode();
  // Upload photos to Cloudinary (or local fallback) before storing
  const photoUrls = await persistPhotos(payload.photos, requestId);
  const request = {
    id: requestId,
    trackingCode,
    source: "formulario_cliente",
    customerName: payload.customerName,
    customerRut: payload.customerRut || "",
    contactPerson: payload.contactPerson,
    contactPhone: payload.contactPhone,
    contactEmail: payload.contactEmail,
    pickupAddress: payload.pickupAddress,
    deliveryAddress: payload.deliveryAddress,
    // Lista completa de entregas (1 retiro → varias entregas). La primera es el
    // destino principal (= deliveryAddress). Vacío/1 si es entrega única.
    deliveryStops: Array.isArray(payload.deliveryStops) ? payload.deliveryStops : [],
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
    acceptanceToken: randomUUID(),
    acceptedAt: null,
  };

  let saved;
  if (HAS_DB) {
    saved = await db.createRequest(request);
  } else {
    store.requests.unshift(request);
    saveStore();
    saved = request;
  }
  await notify({ type: "quote_received", to: saved.contactEmail, requestId: saved.id });
  await notify({ type: "quote_internal", to: "admin@dropit.local", requestId: saved.id });
  return saved;
}

export async function quoteRequest(requestId, payload) {
  // Localizar request — desde DB o store según corresponda
  let request = HAS_DB
    ? await db.findRequest(requestId)
    : store.requests.find((item) => item.id === requestId);

  if (!request) {
    throw new Error("Solicitud no encontrada");
  }

  // Construir actualización
  const updates = {};
  updates.quotedAmount  = Number(payload.quotedAmount);
  updates.serviceType   = payload.serviceType;
  updates.internalNotes = payload.internalNotes || "";
  if (payload.avionetaCount !== undefined) {
    updates.avionetaCount = Number(payload.avionetaCount) || 0;
    updates.avioneta      = updates.avionetaCount > 0;
  }
  if (payload.peonetaUnitCost !== undefined) {
    updates.peonetaUnitCost = Number(payload.peonetaUnitCost) || 0;
  }
  if (payload.discount !== undefined) {
    updates.discount = Number(payload.discount) || 0;
  }
  if (payload.pickupAddress && payload.pickupAddress !== request.pickupAddress) {
    updates.pickupAddress = payload.pickupAddress;
  }
  if (payload.deliveryAddress && payload.deliveryAddress !== request.deliveryAddress) {
    updates.deliveryAddress = payload.deliveryAddress;
  }

  // Track quote revisions
  const newQuotedAmount = updates.quotedAmount;
  if (request.status === "Cotizado") {
    const revisions = Array.isArray(request.quoteRevisions) ? [...request.quoteRevisions] : [];
    revisions.push({
      revisedAt: new Date().toISOString(),
      previousAmount: request.previousQuotedAmount ?? request.quotedAmount ?? null,
      newAmount: newQuotedAmount,
      avionetaCount: (updates.avionetaCount ?? request.avionetaCount) || 0,
      peonetaUnitCost: (updates.peonetaUnitCost ?? request.peonetaUnitCost) || 0,
      discount: (updates.discount ?? request.discount) || 0,
    });
    updates.quoteRevisions = revisions;
  }

  updates.previousQuotedAmount = newQuotedAmount;
  updates.status               = "Cotizado";
  updates.emailSent            = true;
  updates.updatedAt            = new Date().toISOString();
  updates.approximateLocation  = "Cotizacion enviada";

  let updated;
  if (HAS_DB) {
    updated = await db.updateRequest(requestId, updates);
  } else {
    Object.assign(request, updates);
    saveStore();
    updated = request;
  }

  await notify({
    type: "quote_sent",
    to: updated.contactEmail,
    requestId: updated.id,
    payload: {
      amount: updated.quotedAmount,
      serviceType: updated.serviceType,
    },
  });

  return updated;
}

export async function acceptQuoteRequest(requestId, token) {
  const request = HAS_DB
    ? await db.findRequest(requestId)
    : store.requests.find((item) => item.id === requestId);

  if (!request) throw new Error("Solicitud no encontrada");
  if (request.status !== "Cotizado") throw new Error("La solicitud no tiene una cotización activa para aceptar");
  if (token && request.acceptanceToken && request.acceptanceToken !== token) {
    throw new Error("Token de aceptación inválido");
  }

  const updates = {
    status: "Aceptado por cliente",
    acceptedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    approximateLocation: "Aceptado — pendiente de agendamiento",
  };

  let updated;
  if (HAS_DB) {
    updated = await db.updateRequest(requestId, updates);
  } else {
    Object.assign(request, updates);
    saveStore();
    updated = request;
  }

  await notify({ type: "quote_accepted", to: updated.contactEmail, requestId: updated.id });
  return updated;
}

export async function updateRequestStatus(requestId, status, incidentDescription = "") {
  let request = HAS_DB
    ? await db.findRequest(requestId)
    : store.requests.find((item) => item.id === requestId);

  if (!request) {
    throw new Error("Pedido no encontrado");
  }

  const updates = {
    status,
    updatedAt: new Date().toISOString(),
    approximateLocation: status,
  };

  if (status === incidentStatus) {
    updates.hasIncident = true;
    updates.incidentDescription = incidentDescription || "Incidencia registrada";
  }

  let updated;
  if (HAS_DB) {
    updated = await db.updateRequest(requestId, updates);
  } else {
    Object.assign(request, updates);
    saveStore();
    updated = request;
  }

  if (status === incidentStatus) {
    await notify({ type: "order_incident", to: updated.contactEmail, requestId: updated.id });
    return updated;
  }

  const notificationByStatus = {
    Agendado: "order_scheduled",
    "En preparacion": "order_preparing",
    "En ruta": "order_on_route",
    Entregado: "order_delivered",
  };

  if (notificationByStatus[status]) {
    await notify({ type: notificationByStatus[status], to: updated.contactEmail, requestId: updated.id });
  }

  return updated;
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

export async function importOrders(rows) {
  const errors = validateImportRows(rows);
  if (errors.length > 0) {
    return {
      imported: [],
      errors,
    };
  }

  const now = new Date().toISOString();
  const imported = [];

  for (const row of rows) {
    const id           = row.referenceId   || (HAS_DB ? await db.nextRequestId()    : nextReference());
    const trackingCode = row.trackingCode  || (HAS_DB ? await db.nextTrackingCode() : nextTrackingCode());
    const request = {
      id,
      trackingCode,
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

    if (HAS_DB) {
      const saved = await db.createRequest(request);
      imported.push(saved);
    } else {
      store.requests.unshift(request);
      imported.push(request);
    }
  }

  if (!HAS_DB) saveStore();
  return {
    imported,
    errors: [],
  };
}

export async function createRoutePlan(payload) {
  const truck = HAS_DB
    ? await db.findTruck(payload.truckId)
    : store.trucks.find((item) => item.id === payload.truckId);
  if (!truck) {
    throw new Error("Camion no encontrado");
  }

  // Load requests for the route — both code paths return canonical objects
  const selected = [];
  for (const id of payload.requestIds) {
    const r = HAS_DB
      ? await db.findRequest(id)
      : store.requests.find((request) => request.id === id);
    if (r) selected.push(r);
  }

  if (selected.length === 0) {
    throw new Error("Selecciona al menos un pedido");
  }

  const routeId = HAS_DB ? await db.nextRouteCode() : nextRouteCode();
  const status  = payload.startRoute ? "En ruta" : "Agendado";
  const route = {
    id: routeId,
    name: payload.name || `Ruta ${routeId}`,
    requestIds: selected.map((item) => item.id),
    orderedRequestIds: payload.orderedRequestIds?.length ? payload.orderedRequestIds : selected.map((item) => item.id),
    truckId: truck.id,
    truckName: truck.name,
    driverName: payload.driverName || truck.driverName,
    driverPhone: payload.driverPhone || truck.driverPhone,
    status,
    plannedDate: payload.plannedDate,
    optimizationMode: payload.optimizationMode || "visual_manual",
    createdAt: new Date().toISOString(),
  };

  if (HAS_DB) {
    await db.createRoute(route);
    await db.updateTruck(truck.id, { status: payload.startRoute ? "En ruta" : "Disponible" });
    const reqStatus = payload.startRoute ? "En ruta" : "Agendado";
    for (const request of selected) {
      await db.updateRequest(request.id, {
        routeId: route.id,
        truckId: truck.id,
        truckName: truck.name,
        driverName: route.driverName,
        status: reqStatus,
        updatedAt: new Date().toISOString(),
        approximateLocation: reqStatus,
      });
    }
  } else {
    store.routes.unshift(route);
    truck.status = payload.startRoute ? "En ruta" : "Disponible";
    selected.forEach((request) => {
      request.routeId = route.id;
      request.truckId = truck.id;
      request.truckName = truck.name;
      request.driverName = route.driverName;
      request.status = status;
      request.updatedAt = new Date().toISOString();
      request.approximateLocation = status;
    });
    saveStore();
  }

  return route;
}
