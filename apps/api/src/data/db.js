/**
 * db.js — Dropit Service PostgreSQL data layer (FASE 1)
 *
 * Expone CRUD para todas las entidades.  Los services siguen usando store.js
 * (FASE 2 los conectará aquí).  Este módulo puede importarse de forma
 * independiente para scripts de migración y futuros refactors.
 *
 * Requiere: DATABASE_URL en el entorno.
 * Pool usa ssl: { rejectUnauthorized: false } para Railway Postgres.
 */

import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;

// ─── Pool singleton ───────────────────────────────────────────────────────────

let _pool = null;

function getPool() {
  if (_pool) return _pool;

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error(
      "DATABASE_URL no configurada — la app se está corriendo en modo legacy db.json. " +
      "Configura DATABASE_URL en Railway o exporta la variable en tu .env local."
    );
  }

  _pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  _pool.on("error", (err) => {
    console.error("[db] Pool error inesperado:", err.message);
  });

  return _pool;
}

/** Wrapper de query — lanza error descriptivo si DATABASE_URL no está set */
async function query(sql, params) {
  const pool = getPool();
  const result = await pool.query(sql, params);
  return result;
}

// ─── Mapeo camelCase ↔ snake_case ─────────────────────────────────────────────

/**
 * Convierte un objeto de BD (snake_case) a camelCase para el frontend.
 * Los campos JSONB de raw_data se fusionan al nivel raíz.
 */
function fromRow(row) {
  if (!row) return null;

  const raw = row.raw_data || {};

  return {
    id:                     row.id,
    trackingCode:           row.tracking_code,
    source:                 row.source,
    customerName:           row.customer_name,
    customerRut:            row.customer_rut || "",
    contactPerson:          row.contact_person,
    contactPhone:           row.contact_phone || "",
    contactEmail:           row.contact_email || "",
    pickupAddress:          row.pickup_address,
    deliveryAddress:        row.delivery_address,
    destinationCity:        row.destination_city || "",
    packages:               Number(row.packages || 0),
    estimatedWeightKg:      Number(row.estimated_weight_kg || 0),
    cargoDescription:       row.cargo_description || "",
    requiredDate:           row.required_date ? row.required_date.toISOString().slice(0, 10) : "",
    requiredTime:           row.required_time || "",
    distanceKm:             row.distance_km != null ? Number(row.distance_km) : null,
    estimatedPrice:         row.estimated_price != null ? Number(row.estimated_price) : null,
    urgent:                 Boolean(row.urgent),
    observations:           row.observations || "",
    status:                 row.status,
    approximateLocation:    row.approximate_location || "Solicitud recibida",
    hasIncident:            Boolean(row.has_incident),
    incidentDescription:    row.incident_description || "",
    quotedAmount:           row.quoted_amount != null ? Number(row.quoted_amount) : null,
    serviceType:            row.service_type || "",
    internalNotes:          row.internal_notes || "",
    previousQuotedAmount:   row.previous_quoted_amount != null ? Number(row.previous_quoted_amount) : null,
    peonetaCount:           Number(row.peoneta_count || 0),
    peonetaUnitCost:        Number(row.peoneta_unit_cost || 0),
    discount:               Number(row.discount || 0),
    truckId:                row.truck_id || null,
    truckName:              row.truck_name || "",
    driverName:             row.driver_name || "",
    routeId:                row.route_id || null,
    emailSent:              Boolean(row.email_sent),
    whatsappSent:           Boolean(row.whatsapp_sent),
    createdAt:              row.created_at ? row.created_at.toISOString() : null,
    updatedAt:              row.updated_at ? row.updated_at.toISOString() : null,
    // Campos JSONB fusionados desde raw_data
    photos:                 raw.photos         || [],
    bultosDetail:           raw.bultosDetail   || [],
    remindersSent:          raw.remindersSent  || [],
    quoteRevisions:         raw.quoteRevisions || [],
    avioneta:               raw.avioneta       || false,
    avionetaCount:          raw.avionetaCount  || 0,
  };
}

/**
 * Convierte un payload camelCase en columnas snake_case + raw_data JSONB.
 * Retorna { columns, values, rawData } para usar en INSERT/UPDATE.
 */
function toRow(data) {
  const rawData = {
    photos:         data.photos         ?? [],
    bultosDetail:   data.bultosDetail   ?? [],
    remindersSent:  data.remindersSent  ?? [],
    quoteRevisions: data.quoteRevisions ?? [],
    avioneta:       data.avioneta       ?? false,
    avionetaCount:  data.avionetaCount  ?? 0,
  };

  return {
    tracking_code:          data.trackingCode,
    source:                 data.source           || "formulario_cliente",
    customer_name:          data.customerName,
    customer_rut:           data.customerRut      || null,
    contact_person:         data.contactPerson,
    contact_phone:          data.contactPhone     || null,
    contact_email:          data.contactEmail     || null,
    pickup_address:         data.pickupAddress,
    delivery_address:       data.deliveryAddress,
    destination_city:       data.destinationCity  || null,
    packages:               Number(data.packages  || 0),
    estimated_weight_kg:    Number(data.estimatedWeightKg || 0),
    cargo_description:      data.cargoDescription || null,
    required_date:          data.requiredDate     || null,
    required_time:          data.requiredTime     || null,
    distance_km:            data.distanceKm       != null ? Number(data.distanceKm) : null,
    estimated_price:        data.estimatedPrice   != null ? Number(data.estimatedPrice) : null,
    urgent:                 Boolean(data.urgent),
    observations:           data.observations     || null,
    status:                 data.status           || "Pendiente de cotizacion",
    approximate_location:   data.approximateLocation || "Solicitud recibida",
    has_incident:           Boolean(data.hasIncident),
    incident_description:   data.incidentDescription || null,
    quoted_amount:          data.quotedAmount     != null ? Number(data.quotedAmount) : null,
    service_type:           data.serviceType      || null,
    internal_notes:         data.internalNotes    || null,
    previous_quoted_amount: data.previousQuotedAmount != null ? Number(data.previousQuotedAmount) : null,
    peoneta_count:          Number(data.peonetaCount || 0),
    peoneta_unit_cost:      Number(data.peonetaUnitCost || 0),
    discount:               Number(data.discount  || 0),
    truck_id:               data.truckId          || null,
    truck_name:             data.truckName        || null,
    driver_name:            data.driverName       || null,
    route_id:               data.routeId          || null,
    email_sent:             Boolean(data.emailSent),
    whatsapp_sent:          Boolean(data.whatsappSent),
    raw_data:               rawData,
  };
}

function fromTruckRow(row) {
  if (!row) return null;
  return {
    id:           row.id,
    name:         row.name,
    plate:        row.plate,
    maxWeightKg:  Number(row.max_weight_kg || 0),
    maxPackages:  Number(row.max_packages  || 0),
    driverName:   row.driver_name  || "",
    driverPhone:  row.driver_phone || "",
    status:       row.status,
    createdAt:    row.created_at ? row.created_at.toISOString() : null,
    updatedAt:    row.updated_at ? row.updated_at.toISOString() : null,
  };
}

function toTruckRow(data) {
  return {
    name:          data.name,
    plate:         data.plate,
    max_weight_kg: Number(data.maxWeightKg || 0),
    max_packages:  Number(data.maxPackages  || 0),
    driver_name:   data.driverName  || null,
    driver_phone:  data.driverPhone || null,
    status:        data.status      || "Disponible",
  };
}

function fromRouteRow(row) {
  if (!row) return null;
  return {
    id:                 row.id,
    name:               row.name,
    truckId:            row.truck_id    || null,
    truckName:          row.truck_name  || "",
    driverName:         row.driver_name || "",
    driverPhone:        row.driver_phone || "",
    status:             row.status,
    plannedDate:        row.planned_date ? row.planned_date.toISOString().slice(0, 10) : null,
    optimizationMode:   row.optimization_mode || "visual_manual",
    requestIds:         row.request_ids         || [],
    orderedRequestIds:  row.ordered_request_ids  || [],
    createdAt:          row.created_at ? row.created_at.toISOString() : null,
    updatedAt:          row.updated_at ? row.updated_at.toISOString() : null,
  };
}

function toRouteRow(data) {
  return {
    name:                 data.name,
    truck_id:             data.truckId          || null,
    truck_name:           data.truckName        || null,
    driver_name:          data.driverName       || null,
    driver_phone:         data.driverPhone      || null,
    status:               data.status           || "Agendado",
    planned_date:         data.plannedDate      || null,
    optimization_mode:    data.optimizationMode || "visual_manual",
    request_ids:          data.requestIds        || [],
    ordered_request_ids:  data.orderedRequestIds || [],
  };
}

// ─── Helpers para UPDATE dinámico ─────────────────────────────────────────────

/**
 * Construye SET clause para UPDATE.
 * Retorna { setText, values, nextIdx }
 */
function buildSetClause(fields, startIdx = 1) {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  const setText = entries.map(([col], i) => `${col} = $${startIdx + i}`).join(", ");
  const values  = entries.map(([, v]) => v);
  return { setText, values, nextIdx: startIdx + entries.length };
}

// ─── REQUESTS ─────────────────────────────────────────────────────────────────

export async function listRequests() {
  const { rows } = await query(
    "SELECT * FROM quote_requests ORDER BY created_at DESC"
  );
  return rows.map(fromRow);
}

export async function findRequest(id) {
  const { rows } = await query(
    "SELECT * FROM quote_requests WHERE id = $1",
    [id]
  );
  return fromRow(rows[0]);
}

export async function findRequestByTracking(trackingCode) {
  const { rows } = await query(
    "SELECT * FROM quote_requests WHERE tracking_code = $1",
    [trackingCode]
  );
  return fromRow(rows[0]);
}

export async function createRequest(data) {
  const id  = data.id;
  const row = toRow(data);

  const cols   = ["id", ...Object.keys(row)];
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  const vals   = [id, ...Object.values(row)];

  const { rows } = await query(
    `INSERT INTO quote_requests (${cols.join(", ")})
     VALUES (${placeholders})
     RETURNING *`,
    vals
  );
  return fromRow(rows[0]);
}

export async function updateRequest(id, fields) {
  // Separate raw_data fields from top-level columns
  const RAW_KEYS = ["photos", "bultosDetail", "remindersSent", "quoteRevisions", "avioneta", "avionetaCount"];

  const rawUpdates = {};
  const colUpdates = {};

  for (const [k, v] of Object.entries(fields)) {
    if (RAW_KEYS.includes(k)) {
      rawUpdates[k] = v;
    } else {
      // Map camelCase to snake_case for known columns
      const snakeMap = {
        trackingCode:         "tracking_code",
        source:               "source",
        customerName:         "customer_name",
        customerRut:          "customer_rut",
        contactPerson:        "contact_person",
        contactPhone:         "contact_phone",
        contactEmail:         "contact_email",
        pickupAddress:        "pickup_address",
        deliveryAddress:      "delivery_address",
        destinationCity:      "destination_city",
        packages:             "packages",
        estimatedWeightKg:    "estimated_weight_kg",
        cargoDescription:     "cargo_description",
        requiredDate:         "required_date",
        requiredTime:         "required_time",
        distanceKm:           "distance_km",
        estimatedPrice:       "estimated_price",
        urgent:               "urgent",
        observations:         "observations",
        status:               "status",
        approximateLocation:  "approximate_location",
        hasIncident:          "has_incident",
        incidentDescription:  "incident_description",
        quotedAmount:         "quoted_amount",
        serviceType:          "service_type",
        internalNotes:        "internal_notes",
        previousQuotedAmount: "previous_quoted_amount",
        peonetaCount:         "peoneta_count",
        peonetaUnitCost:      "peoneta_unit_cost",
        discount:             "discount",
        truckId:              "truck_id",
        truckName:            "truck_name",
        driverName:           "driver_name",
        routeId:              "route_id",
        emailSent:            "email_sent",
        whatsappSent:         "whatsapp_sent",
      };
      const col = snakeMap[k] || k;
      colUpdates[col] = v;
    }
  }

  colUpdates.updated_at = new Date();

  let setClauses = [];
  let values     = [];
  let idx        = 1;

  // Standard column updates
  if (Object.keys(colUpdates).length > 0) {
    const { setText, values: colVals, nextIdx } = buildSetClause(colUpdates, idx);
    setClauses.push(setText);
    values.push(...colVals);
    idx = nextIdx;
  }

  // Merge raw_data fields via jsonb_build_object
  if (Object.keys(rawUpdates).length > 0) {
    const jsonbParts = Object.entries(rawUpdates)
      .map(([k, v]) => {
        values.push(JSON.stringify(v));
        return `'${k}', $${idx++}::jsonb`;
      })
      .join(", ");
    setClauses.push(`raw_data = raw_data || jsonb_build_object(${jsonbParts})`);
  }

  if (setClauses.length === 0) {
    return findRequest(id);
  }

  values.push(id);
  const { rows } = await query(
    `UPDATE quote_requests SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );
  return fromRow(rows[0]);
}

export async function deleteRequest(id) {
  await query("DELETE FROM quote_requests WHERE id = $1", [id]);
}

// ─── TRUCKS ───────────────────────────────────────────────────────────────────

export async function listTrucks() {
  const { rows } = await query("SELECT * FROM trucks ORDER BY name");
  return rows.map(fromTruckRow);
}

export async function findTruck(id) {
  const { rows } = await query("SELECT * FROM trucks WHERE id = $1", [id]);
  return fromTruckRow(rows[0]);
}

export async function createTruck(data) {
  const id  = data.id;
  const row = toTruckRow(data);

  const cols         = ["id", ...Object.keys(row)];
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  const vals         = [id, ...Object.values(row)];

  const { rows } = await query(
    `INSERT INTO trucks (${cols.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    vals
  );
  return fromTruckRow(rows[0]);
}

export async function updateTruck(id, fields) {
  const snakeMap = {
    name:         "name",
    plate:        "plate",
    maxWeightKg:  "max_weight_kg",
    maxPackages:  "max_packages",
    driverName:   "driver_name",
    driverPhone:  "driver_phone",
    status:       "status",
  };

  const colUpdates = { updated_at: new Date() };
  for (const [k, v] of Object.entries(fields)) {
    const col = snakeMap[k] || k;
    colUpdates[col] = v;
  }

  const { setText, values } = buildSetClause(colUpdates, 1);
  values.push(id);

  const { rows } = await query(
    `UPDATE trucks SET ${setText} WHERE id = $${values.length} RETURNING *`,
    values
  );
  return fromTruckRow(rows[0]);
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────

export async function listRoutes() {
  const { rows } = await query("SELECT * FROM routes ORDER BY created_at DESC");
  return rows.map(fromRouteRow);
}

export async function findRoute(id) {
  const { rows } = await query("SELECT * FROM routes WHERE id = $1", [id]);
  return fromRouteRow(rows[0]);
}

export async function createRoute(data) {
  const id  = data.id;
  const row = toRouteRow(data);

  const cols         = ["id", ...Object.keys(row)];
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  const vals         = [id, ...Object.values(row)];

  const { rows } = await query(
    `INSERT INTO routes (${cols.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    vals
  );
  return fromRouteRow(rows[0]);
}

export async function updateRoute(id, fields) {
  const snakeMap = {
    name:               "name",
    truckId:            "truck_id",
    truckName:          "truck_name",
    driverName:         "driver_name",
    driverPhone:        "driver_phone",
    status:             "status",
    plannedDate:        "planned_date",
    optimizationMode:   "optimization_mode",
    requestIds:         "request_ids",
    orderedRequestIds:  "ordered_request_ids",
  };

  const colUpdates = { updated_at: new Date() };
  for (const [k, v] of Object.entries(fields)) {
    const col = snakeMap[k] || k;
    colUpdates[col] = v;
  }

  const { setText, values } = buildSetClause(colUpdates, 1);
  values.push(id);

  const { rows } = await query(
    `UPDATE routes SET ${setText} WHERE id = $${values.length} RETURNING *`,
    values
  );
  return fromRouteRow(rows[0]);
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

export async function createNotification(data) {
  const { rows } = await query(
    `INSERT INTO notifications (id, type, title, to_address, request_id, payload, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.id,
      data.type,
      data.title || data.type,
      data.to   || data.toAddress || null,
      data.requestId || null,
      JSON.stringify(data.payload || {}),
      data.status || "simulada",
    ]
  );
  return rows[0];
}

export async function listNotifications(limit = 50) {
  const { rows } = await query(
    "SELECT * FROM notifications ORDER BY created_at DESC LIMIT $1",
    [limit]
  );
  return rows;
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

export async function getSetting(key) {
  const { rows } = await query(
    "SELECT value FROM settings WHERE key = $1",
    [key]
  );
  if (!rows[0]) return null;
  // value ya es objeto parseado por el driver pg
  return rows[0].value;
}

export async function setSetting(key, value) {
  await query(
    `INSERT INTO settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, JSON.stringify(value)]
  );
}

// ─── USERS ────────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;

export async function listUsers() {
  const { rows } = await query(
    "SELECT id, email, name, role, is_active, created_at, updated_at FROM users ORDER BY created_at"
  );
  return rows.map((r) => ({
    id:        r.id,
    email:     r.email,
    name:      r.name,
    role:      r.role,
    isActive:  r.is_active,
    createdAt: r.created_at ? r.created_at.toISOString() : null,
    updatedAt: r.updated_at ? r.updated_at.toISOString() : null,
  }));
}

export async function findUser(id) {
  const { rows } = await query(
    "SELECT id, email, name, role, is_active, created_at, updated_at FROM users WHERE id = $1",
    [id]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id:        r.id,
    email:     r.email,
    name:      r.name,
    role:      r.role,
    isActive:  r.is_active,
    createdAt: r.created_at ? r.created_at.toISOString() : null,
    updatedAt: r.updated_at ? r.updated_at.toISOString() : null,
  };
}

export async function findUserByEmail(email) {
  const { rows } = await query(
    "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
    [email]
  );
  return rows[0] || null;
}

export async function createUser(data) {
  const hash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const { rows } = await query(
    `INSERT INTO users (id, email, name, password_hash, role, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, email, name, role, is_active, created_at, updated_at`,
    [
      data.id,
      data.email,
      data.name,
      hash,
      data.role       || "operator",
      data.isActive   !== undefined ? data.isActive : true,
    ]
  );
  const r = rows[0];
  return {
    id:        r.id,
    email:     r.email,
    name:      r.name,
    role:      r.role,
    isActive:  r.is_active,
    createdAt: r.created_at ? r.created_at.toISOString() : null,
    updatedAt: r.updated_at ? r.updated_at.toISOString() : null,
  };
}

export async function updateUser(id, fields) {
  const snakeMap = {
    email:    "email",
    name:     "name",
    role:     "role",
    isActive: "is_active",
    password: "_password_plain", // señal especial → hashear
  };

  const colUpdates = { updated_at: new Date() };
  for (const [k, v] of Object.entries(fields)) {
    if (k === "password") {
      colUpdates["password_hash"] = await bcrypt.hash(v, BCRYPT_ROUNDS);
    } else {
      const col = snakeMap[k] || k;
      colUpdates[col] = v;
    }
  }

  const { setText, values } = buildSetClause(colUpdates, 1);
  values.push(id);

  const { rows } = await query(
    `UPDATE users SET ${setText} WHERE id = $${values.length}
     RETURNING id, email, name, role, is_active, created_at, updated_at`,
    values
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id:        r.id,
    email:     r.email,
    name:      r.name,
    role:      r.role,
    isActive:  r.is_active,
    createdAt: r.created_at ? r.created_at.toISOString() : null,
    updatedAt: r.updated_at ? r.updated_at.toISOString() : null,
  };
}

/**
 * Verifica email + contraseña.
 * Retorna el user (sin password_hash) si es válido, o null si no.
 */
export async function verifyPassword(email, plainPassword) {
  const row = await findUserByEmail(email);
  if (!row) return null;
  const ok = await bcrypt.compare(plainPassword, row.password_hash);
  if (!ok) return null;
  return {
    id:       row.id,
    email:    row.email,
    name:     row.name,
    role:     row.role,
    isActive: row.is_active,
  };
}

// ─── SEQUENCES (reemplazan nextReference / nextTrackingCode / nextRouteCode) ──

export async function nextRequestId() {
  const { rows } = await query("SELECT nextval('request_seq') AS n");
  return `SOL-${rows[0].n}`;
}

export async function nextTrackingCode() {
  const { rows } = await query("SELECT nextval('tracking_seq') AS n");
  return `DRP-${rows[0].n}`;
}

export async function nextRouteCode() {
  const { rows } = await query("SELECT nextval('route_seq') AS n");
  return `RUT-${rows[0].n}`;
}

// ─── Internal helpers exposed for admin endpoints / migration scripts ─────────
export function getPoolInstance() {
  return getPool();
}
export { query as rawQuery };
