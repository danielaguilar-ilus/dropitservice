import { Router } from "express";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";

const router = Router();

// ─── Lightweight gate ─────────────────────────────────────────────────────────
// All endpoints here require a secret token to avoid accidental exposure.
// Set ADMIN_TOKEN in Railway env vars; default is a random-ish string that
// the operator should rotate. Pass as ?token=... or header X-Admin-Token.
const ADMIN_TOKEN =
  process.env.ADMIN_TOKEN ||
  "dropit-migrate-2026-CHANGE-ME-IN-RAILWAY";

function requireAdmin(req, res, next) {
  const provided = req.query.token || req.headers["x-admin-token"];
  if (!provided || provided !== ADMIN_TOKEN) {
    return res.status(401).json({
      ok: false,
      message: "Token admin requerido. Pasa ?token=... o header X-Admin-Token.",
    });
  }
  next();
}

// ─── GET /api/_admin/db-status ────────────────────────────────────────────────
// Inspects whether Postgres is configured + reachable.
router.get("/db-status", requireAdmin, async (_req, res) => {
  const hasUrl = !!process.env.DATABASE_URL;
  if (!hasUrl) {
    return res.json({
      ok: false,
      databaseUrl: false,
      message: "DATABASE_URL no está set en Railway. Vincula la variable desde el servicio Postgres.",
    });
  }
  try {
    const dbMod = await import("../data/db.js");
    const pool = dbMod.getPoolInstance();
    const result = await pool.query("SELECT NOW() as now, current_database() as db");
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name
    `);
    return res.json({
      ok: true,
      databaseUrl: true,
      now: result.rows[0].now,
      database: result.rows[0].db,
      tables: tables.rows.map((r) => r.table_name),
      schemaReady: tables.rows.length >= 6,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      databaseUrl: true,
      error: { message: err.message, code: err.code, stack: err.stack },
    });
  }
});

// ─── POST /api/_admin/run-schema ──────────────────────────────────────────────
// Executes the SQL in apps/api/db/schema.sql against DATABASE_URL.
// Idempotent — all CREATEs use IF NOT EXISTS or ON CONFLICT.
router.post("/run-schema", requireAdmin, async (_req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(400).json({ ok: false, message: "DATABASE_URL no está set." });
  }
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const schemaPath = join(__dirname, "../../db/schema.sql");
    if (!existsSync(schemaPath)) {
      return res.status(500).json({ ok: false, message: `schema.sql no encontrado en ${schemaPath}` });
    }
    const schemaSql = readFileSync(schemaPath, "utf8");

    const dbMod = await import("../data/db.js");
    const pool = dbMod.getPoolInstance();

    // Execute the whole file as a single statement — Postgres handles it.
    await pool.query(schemaSql);

    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name
    `);
    return res.json({
      ok: true,
      message: "Schema ejecutado correctamente.",
      tables: tables.rows.map((r) => r.table_name),
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: { message: err.message, code: err.code, position: err.position, stack: err.stack },
    });
  }
});

// ─── POST /api/_admin/migrate-from-json ───────────────────────────────────────
// Reads db.json (from DATA_DIR or local fallback) and inserts into Postgres.
// Idempotent via ON CONFLICT DO NOTHING. Returns counts per table.
router.post("/migrate-from-json", requireAdmin, async (_req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(400).json({ ok: false, message: "DATABASE_URL no está set." });
  }
  try {
    // Locate db.json: prefer DATA_DIR, fall back to apps/api/db.json
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const dataDir = process.env.DATA_DIR || join(__dirname, "../..");
    const dbJsonPath = join(dataDir, "db.json");

    if (!existsSync(dbJsonPath)) {
      return res.status(404).json({
        ok: false,
        message: `db.json no encontrado en ${dbJsonPath}`,
        hint: "Verifica DATA_DIR y que el Volume esté montado.",
      });
    }
    const data = JSON.parse(readFileSync(dbJsonPath, "utf8"));

    const dbMod = await import("../data/db.js");
    const pool = dbMod.getPoolInstance();

    const counts = { users: 0, trucks: 0, requests: 0, routes: 0, notifications: 0 };
    const errors = [];

    // 1) Users — hash plaintext passwords with bcrypt
    for (const u of data.users || []) {
      try {
        const passwordHash = u.password_hash || (u.password ? await bcrypt.hash(u.password, 10) : "");
        await pool.query(
          `INSERT INTO users (id, email, name, password_hash, role, is_active)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [u.id, u.email, u.name, passwordHash, u.role || "operator", u.is_active !== false]
        );
        counts.users++;
      } catch (e) {
        errors.push({ entity: "users", id: u.id, error: e.message });
      }
    }

    // 2) Trucks
    for (const t of data.trucks || []) {
      try {
        await pool.query(
          `INSERT INTO trucks (id, name, plate, max_weight_kg, max_packages, driver_name, driver_phone, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING`,
          [
            t.id, t.name, t.plate,
            t.maxWeightKg || 0, t.maxPackages || 0,
            t.driverName || null, t.driverPhone || null,
            t.status || "Disponible",
          ]
        );
        counts.trucks++;
      } catch (e) {
        errors.push({ entity: "trucks", id: t.id, error: e.message });
      }
    }

    // 3) Quote requests — JSONB raw_data carries the bag-of-extras
    for (const r of data.requests || []) {
      try {
        const rawData = {
          bultosDetail: r.bultosDetail || [],
          remindersSent: r.remindersSent || [],
          quoteRevisions: r.quoteRevisions || [],
          photos: r.photos || [],
          avioneta: r.avioneta || false,
        };
        await pool.query(
          `INSERT INTO quote_requests (
             id, tracking_code, source, customer_name, customer_rut,
             contact_person, contact_phone, contact_email,
             pickup_address, delivery_address, destination_city,
             packages, estimated_weight_kg, cargo_description,
             required_date, required_time, distance_km, estimated_price,
             urgent, observations, status, approximate_location,
             has_incident, incident_description,
             quoted_amount, service_type, internal_notes,
             previous_quoted_amount, peoneta_count, peoneta_unit_cost, discount,
             truck_id, truck_name, driver_name, route_id,
             email_sent, whatsapp_sent, raw_data, created_at, updated_at
           )
           VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
             $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
             $31, $32, $33, $34, $35, $36, $37, $38, $39, $40
           )
           ON CONFLICT (id) DO NOTHING`,
          [
            r.id, r.trackingCode, r.source || "formulario_cliente",
            r.customerName, r.customerRut || null,
            r.contactPerson, r.contactPhone || null, r.contactEmail || null,
            r.pickupAddress, r.deliveryAddress, r.destinationCity || null,
            r.packages || 0, r.estimatedWeightKg || 0, r.cargoDescription || null,
            r.requiredDate || null, r.requiredTime || null,
            r.distanceKm || null, r.estimatedPrice || null,
            r.urgent || false, r.observations || null,
            r.status || "Pendiente de cotizacion", r.approximateLocation || "Solicitud recibida",
            r.hasIncident || false, r.incidentDescription || null,
            r.quotedAmount || null, r.serviceType || null, r.internalNotes || null,
            r.previousQuotedAmount || null,
            r.avionetaCount || 0, r.peonetaUnitCost || 0, r.discount || 0,
            r.truckId || null, r.truckName || null, r.driverName || null, r.routeId || null,
            r.emailSent || false, r.whatsappSent || false,
            JSON.stringify(rawData),
            r.createdAt || new Date().toISOString(),
            r.updatedAt || new Date().toISOString(),
          ]
        );
        counts.requests++;
      } catch (e) {
        errors.push({ entity: "requests", id: r.id, error: e.message });
      }
    }

    // 4) Routes
    for (const rt of data.routes || []) {
      try {
        await pool.query(
          `INSERT INTO routes (id, name, truck_id, truck_name, driver_name, driver_phone,
             status, planned_date, optimization_mode, request_ids, ordered_request_ids,
             created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (id) DO NOTHING`,
          [
            rt.id, rt.name, rt.truckId || null, rt.truckName || null,
            rt.driverName || null, rt.driverPhone || null,
            rt.status || "Agendado", rt.plannedDate || null,
            rt.optimizationMode || "visual_manual",
            rt.requestIds || [], rt.orderedRequestIds || rt.requestIds || [],
            rt.createdAt || new Date().toISOString(),
          ]
        );
        counts.routes++;
      } catch (e) {
        errors.push({ entity: "routes", id: rt.id, error: e.message });
      }
    }

    // 5) Notifications
    for (const n of data.notifications || []) {
      try {
        await pool.query(
          `INSERT INTO notifications (id, type, title, to_address, request_id, payload, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING`,
          [
            n.id, n.type, n.title, n.to || null, n.requestId || null,
            JSON.stringify(n.payload || {}),
            n.status || "simulada",
            n.createdAt || new Date().toISOString(),
          ]
        );
        counts.notifications++;
      } catch (e) {
        errors.push({ entity: "notifications", id: n.id, error: e.message });
      }
    }

    // 6) Align sequences to max(id_numeric) + 1
    await pool.query(`
      SELECT setval('request_seq',  COALESCE((SELECT MAX(CAST(SUBSTRING(id FROM 5) AS INTEGER)) FROM quote_requests), 1100));
      SELECT setval('tracking_seq', COALESCE((SELECT MAX(CAST(SUBSTRING(tracking_code FROM 5) AS INTEGER)) FROM quote_requests), 1100));
      SELECT setval('route_seq',    COALESCE((SELECT MAX(CAST(SUBSTRING(id FROM 5) AS INTEGER)) FROM routes), 1100));
    `).catch(() => {}); // sequences might not exist if schema wasn't run

    return res.json({
      ok: errors.length === 0,
      counts,
      errors: errors.slice(0, 20), // cap at 20 errors to avoid huge responses
      errorCount: errors.length,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: { message: err.message, code: err.code, stack: err.stack },
    });
  }
});

export default router;
