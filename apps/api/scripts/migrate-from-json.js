#!/usr/bin/env node
/**
 * migrate-from-json.js — Dropit Service
 *
 * Migra datos de db.json a PostgreSQL.
 * Idempotente: usa ON CONFLICT DO NOTHING → se puede volver a correr sin duplicar datos.
 *
 * Uso:
 *   DATABASE_URL=postgres://... node apps/api/scripts/migrate-from-json.js
 *
 * Variables de entorno:
 *   DATABASE_URL  — (requerida) conexión Postgres
 *   DATA_DIR      — (opcional) directorio donde está db.json; default: apps/api/
 */

import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;

// ─── Config ───────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL no está configurada.");
  console.error("Exporta la variable antes de correr el script:");
  console.error("  $env:DATABASE_URL = 'postgresql://...'   (PowerShell)");
  console.error("  export DATABASE_URL='postgresql://...'   (bash)");
  process.exit(1);
}

// db.json puede estar en DATA_DIR o en apps/api/
const DATA_DIR = process.env.DATA_DIR || join(__dirname, "..");
const DB_PATH  = join(DATA_DIR, "db.json");

if (!existsSync(DB_PATH)) {
  console.error(`ERROR: No se encontró db.json en: ${DB_PATH}`);
  console.error("Ajusta DATA_DIR si el archivo está en otro lugar.");
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;

function num(v) {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function extractNumericId(id = "") {
  const n = parseInt(id.replace(/\D/g, ""), 10);
  return isNaN(n) ? null : n;
}

/** Máximo numérico de un array de IDs con prefijo (SOL-1005 → 1005) */
function maxId(arr, field = "id") {
  return arr.reduce((max, item) => {
    const n = extractNumericId(item[field] || "");
    return n != null && n > max ? n : max;
  }, 0);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Dropit — Migración db.json → PostgreSQL ===\n`);
  console.log(`Leyendo: ${DB_PATH}`);

  const raw = JSON.parse(readFileSync(DB_PATH, "utf8"));
  const jsonRequests     = Array.isArray(raw.requests)  ? raw.requests  : [];
  const jsonTrucks       = Array.isArray(raw.trucks)    ? raw.trucks    : [];
  const jsonRoutes       = Array.isArray(raw.routes)    ? raw.routes    : [];
  const jsonNotifs       = Array.isArray(raw.notifications) ? raw.notifications : [];
  const jsonMedia        = raw.media   || null;
  const jsonPricing      = raw.pricing || null;

  console.log(`Encontrado en db.json:`);
  console.log(`  ${jsonRequests.length} solicitudes`);
  console.log(`  ${jsonTrucks.length} camiones`);
  console.log(`  ${jsonRoutes.length} rutas`);
  console.log(`  ${jsonNotifs.length} notificaciones\n`);

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── 1. USERS ──────────────────────────────────────────────────────────────
    console.log("Migrando usuarios...");

    // Usuarios hardcoded en store.js (no están en db.json)
    const hardcodedUsers = [
      {
        id:       "usr-super-admin",
        email:    "Juandaniel.aguilar17@gmail.com",
        name:     "Juandaniel Aguilar",
        password: "19109364Daniel",
        role:     "super_admin",
      },
    ];

    let usersCount = 0;
    for (const u of hardcodedUsers) {
      const hash = await bcrypt.hash(u.password, BCRYPT_ROUNDS);
      const result = await client.query(
        `INSERT INTO users (id, email, name, password_hash, role, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (id) DO NOTHING`,
        [u.id, u.email, u.name, hash, u.role]
      );
      usersCount += result.rowCount;
    }
    console.log(`  ✓ ${usersCount} usuarios migrados (${hardcodedUsers.length - usersCount} ya existian)\n`);

    // ── 2. TRUCKS ─────────────────────────────────────────────────────────────
    console.log("Migrando camiones...");
    let trucksCount = 0;
    for (const t of jsonTrucks) {
      const result = await client.query(
        `INSERT INTO trucks (id, name, plate, max_weight_kg, max_packages, driver_name, driver_phone, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [
          t.id,
          t.name,
          t.plate,
          num(t.maxWeightKg),
          num(t.maxPackages),
          t.driverName  || null,
          t.driverPhone || null,
          t.status      || "Disponible",
        ]
      );
      trucksCount += result.rowCount;
    }
    console.log(`  ✓ ${trucksCount} camiones migrados (${jsonTrucks.length - trucksCount} ya existian)\n`);

    // ── 3. QUOTE_REQUESTS ────────────────────────────────────────────────────
    console.log("Migrando solicitudes...");
    let reqCount = 0;
    let reqSkip  = 0;

    for (const r of jsonRequests) {
      // Filtrar base64 gigante de photos — guardar sólo URLs
      const photos = Array.isArray(r.photos)
        ? r.photos.filter(p => typeof p === "string" && !p.startsWith("data:"))
        : [];

      const rawData = {
        photos:         photos,
        bultosDetail:   Array.isArray(r.bultosDetail)  ? r.bultosDetail  : [],
        remindersSent:  Array.isArray(r.remindersSent) ? r.remindersSent : [],
        quoteRevisions: Array.isArray(r.quoteRevisions)? r.quoteRevisions: [],
        avioneta:       r.avioneta      || false,
        avionetaCount:  num(r.avionetaCount),
      };

      try {
        const result = await client.query(
          `INSERT INTO quote_requests (
            id, tracking_code, source,
            customer_name, customer_rut, contact_person, contact_phone, contact_email,
            pickup_address, delivery_address, destination_city,
            packages, estimated_weight_kg, cargo_description,
            required_date, required_time, distance_km, estimated_price,
            urgent, observations, status, approximate_location,
            has_incident, incident_description,
            quoted_amount, service_type, internal_notes, previous_quoted_amount,
            peoneta_count, peoneta_unit_cost, discount,
            truck_id, truck_name, driver_name, route_id,
            email_sent, whatsapp_sent,
            raw_data,
            created_at, updated_at
          ) VALUES (
            $1,  $2,  $3,
            $4,  $5,  $6,  $7,  $8,
            $9,  $10, $11,
            $12, $13, $14,
            $15, $16, $17, $18,
            $19, $20, $21, $22,
            $23, $24,
            $25, $26, $27, $28,
            $29, $30, $31,
            $32, $33, $34, $35,
            $36, $37,
            $38,
            $39, $40
          )
          ON CONFLICT (id) DO NOTHING`,
          [
            r.id,
            r.trackingCode,
            r.source || "formulario_cliente",
            r.customerName   || r.contactPerson || "Sin nombre",
            r.customerRut    || null,
            r.contactPerson,
            r.contactPhone   || null,
            r.contactEmail   || null,
            r.pickupAddress,
            r.deliveryAddress,
            r.destinationCity || null,
            num(r.packages),
            num(r.estimatedWeightKg),
            r.cargoDescription || null,
            r.requiredDate     || null,
            r.requiredTime     || null,
            r.distanceKm       != null ? num(r.distanceKm)   : null,
            r.estimatedPrice   != null ? num(r.estimatedPrice): null,
            Boolean(r.urgent),
            r.observations     || null,
            r.status           || "Pendiente de cotizacion",
            r.approximateLocation || "Solicitud recibida",
            Boolean(r.hasIncident),
            r.incidentDescription || null,
            r.quotedAmount   != null ? num(r.quotedAmount)         : null,
            r.serviceType    || null,
            r.internalNotes  || null,
            r.previousQuotedAmount != null ? num(r.previousQuotedAmount) : null,
            num(r.peonetaCount   || r.peoneta_count   || 0),
            num(r.peonetaUnitCost || r.peoneta_unit_cost || 0),
            num(r.discount || 0),
            r.truckId   || null,
            r.truckName || null,
            r.driverName || null,
            r.routeId   || null,
            Boolean(r.emailSent),
            Boolean(r.whatsappSent),
            JSON.stringify(rawData),
            r.createdAt || new Date().toISOString(),
            r.updatedAt || new Date().toISOString(),
          ]
        );
        if (result.rowCount > 0) {
          reqCount++;
        } else {
          reqSkip++;
        }
      } catch (err) {
        console.warn(`  ⚠ Solicitud ${r.id} saltada: ${err.message}`);
        reqSkip++;
      }
    }
    console.log(`  ✓ ${reqCount} solicitudes migradas (${reqSkip} ya existian o saltadas)\n`);

    // ── 4. ROUTES ────────────────────────────────────────────────────────────
    console.log("Migrando rutas...");
    let routesCount = 0;
    for (const rt of jsonRoutes) {
      try {
        const result = await client.query(
          `INSERT INTO routes (
            id, name, truck_id, truck_name, driver_name, driver_phone,
            status, planned_date, optimization_mode,
            request_ids, ordered_request_ids,
            created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          ON CONFLICT (id) DO NOTHING`,
          [
            rt.id,
            rt.name || `Ruta ${rt.id}`,
            rt.truckId    || null,
            rt.truckName  || null,
            rt.driverName || null,
            rt.driverPhone || null,
            rt.status     || "Agendado",
            rt.plannedDate || null,
            rt.optimizationMode || "visual_manual",
            Array.isArray(rt.requestIds)        ? rt.requestIds        : [],
            Array.isArray(rt.orderedRequestIds) ? rt.orderedRequestIds : [],
            rt.createdAt  || new Date().toISOString(),
            rt.updatedAt  || new Date().toISOString(),
          ]
        );
        routesCount += result.rowCount;
      } catch (err) {
        console.warn(`  ⚠ Ruta ${rt.id} saltada: ${err.message}`);
      }
    }
    console.log(`  ✓ ${routesCount} rutas migradas (${jsonRoutes.length - routesCount} ya existian)\n`);

    // ── 5. NOTIFICATIONS ─────────────────────────────────────────────────────
    console.log("Migrando notificaciones...");
    let notifsCount = 0;
    for (const n of jsonNotifs) {
      try {
        const result = await client.query(
          `INSERT INTO notifications (id, type, title, to_address, request_id, payload, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (id) DO NOTHING`,
          [
            n.id,
            n.type,
            n.title || n.type,
            n.to   || n.toAddress || null,
            n.requestId || null,
            JSON.stringify(n.payload || {}),
            n.status || "simulada",
            n.createdAt || new Date().toISOString(),
          ]
        );
        notifsCount += result.rowCount;
      } catch (err) {
        console.warn(`  ⚠ Notificacion ${n.id} saltada: ${err.message}`);
      }
    }
    console.log(`  ✓ ${notifsCount} notificaciones migradas\n`);

    // ── 6. SETTINGS ──────────────────────────────────────────────────────────
    console.log("Migrando settings...");
    let settingsCount = 0;

    if (jsonPricing) {
      await client.query(
        `INSERT INTO settings (key, value) VALUES ('pricing', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [JSON.stringify(jsonPricing)]
      );
      settingsCount++;
    }

    if (jsonMedia) {
      await client.query(
        `INSERT INTO settings (key, value) VALUES ('media', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [JSON.stringify(jsonMedia)]
      );
      settingsCount++;
    }
    console.log(`  ✓ ${settingsCount} settings migrados\n`);

    // ── 7. AJUSTAR SEQUENCES ─────────────────────────────────────────────────
    console.log("Ajustando sequences...");

    const maxReqNum     = maxId(jsonRequests, "id");
    const maxTrackNum   = maxId(jsonRequests, "trackingCode");
    const maxRouteNum   = maxId(jsonRoutes,   "id");

    const newReqSeq   = Math.max(maxReqNum,   1099) + 1;
    const newTrackSeq = Math.max(maxTrackNum, 1099) + 1;
    const newRouteSeq = Math.max(maxRouteNum, 1099) + 1;

    await client.query(`SELECT setval('request_seq',  $1, false)`, [newReqSeq]);
    await client.query(`SELECT setval('tracking_seq', $1, false)`, [newTrackSeq]);
    await client.query(`SELECT setval('route_seq',    $1, false)`, [newRouteSeq]);

    console.log(`  ✓ request_seq  → ${newReqSeq}   (próximo SOL-${newReqSeq})`);
    console.log(`  ✓ tracking_seq → ${newTrackSeq}  (próximo DRP-${newTrackSeq})`);
    console.log(`  ✓ route_seq    → ${newRouteSeq}  (próximo RUT-${newRouteSeq})\n`);

    await client.query("COMMIT");

    console.log("=== Migración completada exitosamente ===\n");
    console.log(`Resumen final:`);
    console.log(`  Usuarios     : ${hardcodedUsers.length}`);
    console.log(`  Camiones     : ${trucksCount}`);
    console.log(`  Solicitudes  : ${reqCount}`);
    console.log(`  Rutas        : ${routesCount}`);
    console.log(`  Notificaciones: ${notifsCount}`);
    console.log(`  Settings     : ${settingsCount}`);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\n=== ERROR durante la migración — ROLLBACK ejecutado ===");
    console.error(err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Error fatal:", err.message);
  process.exit(1);
});
