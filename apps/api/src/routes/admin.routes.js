import { Router } from "express";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import pg from "pg";
import { requireAdminToken } from "../middleware/auth.js";

const { Pool } = pg;
const router = Router();

// ─── Migración Railway → Cloud SQL (temporal, se retira tras el corte) ────────
function makePool(connectionString) {
  const isSocket = connectionString.includes("/cloudsql/");
  return new Pool({
    connectionString,
    ssl: isSocket ? false : { rejectUnauthorized: false },
    max: 5,
  });
}

// Copia una tabla completa de sourcePool a targetPool, idempotente
// (ON CONFLICT DO NOTHING sobre la primary key). JSONB se serializa a texto
// porque `pg` no lo hace solo al reinsertar objetos ya parseados; los arrays
// (TEXT[]) se dejan tal cual para que el driver los serialice como array PG.
async function copyTable(sourcePool, targetPool, table, pkCol) {
  const { rows } = await sourcePool.query(`SELECT * FROM ${table}`);
  if (rows.length === 0) return { table, total: 0, copied: 0 };
  const columns = Object.keys(rows[0]);
  const colList = columns.map((c) => `"${c}"`).join(", ");
  let copied = 0;
  const CHUNK = 50;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const values = [];
    const rowsSql = chunk
      .map((row) => {
        const placeholders = columns.map((c) => {
          let v = row[c];
          if (v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
            v = JSON.stringify(v);
          }
          values.push(v);
          return `$${values.length}`;
        });
        return `(${placeholders.join(", ")})`;
      })
      .join(", ");
    const sql = `INSERT INTO ${table} (${colList}) VALUES ${rowsSql} ON CONFLICT ("${pkCol}") DO NOTHING`;
    const result = await targetPool.query(sql, values);
    copied += result.rowCount;
  }
  return { table, total: rows.length, copied };
}

const MIGRATION_ORDER = [
  ["users", "id"],
  ["trucks", "id"],
  ["settings", "key"],
  ["quote_requests", "id"],
  ["routes", "id"],
  ["notifications", "id"],
];

// Todos los endpoints /_admin/* requieren ADMIN_TOKEN (sin default inseguro:
// si ADMIN_TOKEN no está configurado en el server, devuelve 503).
const requireAdmin = requireAdminToken;

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

// ─── POST /api/_admin/migrate-to-cloudsql ─────────────────────────────────────
// Copia el contenido de DATABASE_URL (origen, Railway) a CLOUDSQL_DATABASE_URL
// (destino). Idempotente (ON CONFLICT DO NOTHING) — se puede reintentar sin
// duplicar filas. NO borra ni toca el origen. Requiere ADMIN_TOKEN.
router.post("/migrate-to-cloudsql", requireAdmin, async (_req, res) => {
  const targetUrl = process.env.CLOUDSQL_DATABASE_URL;
  if (!targetUrl) {
    return res.status(400).json({ ok: false, message: "CLOUDSQL_DATABASE_URL no está configurado." });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(400).json({ ok: false, message: "DATABASE_URL (origen) no está set." });
  }
  const targetPool = makePool(targetUrl);
  try {
    const dbMod = await import("../data/db.js");
    const sourcePool = dbMod.getPoolInstance();

    const existing = await targetPool.query(`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `);
    if (existing.rows.length === 0) {
      const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "../../db/schema.sql");
      const schemaSql = readFileSync(schemaPath, "utf8");
      await targetPool.query(schemaSql);
    }

    const results = [];
    for (const [table, pk] of MIGRATION_ORDER) {
      results.push(await copyTable(sourcePool, targetPool, table, pk));
    }

    return res.json({ ok: true, results });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: { message: err.message, code: err.code, position: err.position, stack: err.stack },
    });
  } finally {
    await targetPool.end().catch(() => {});
  }
});

// ─── GET /api/_admin/cloudsql-status ───────────────────────────────────────────
// Cuenta filas en el destino (Cloud SQL) por tabla, para comparar contra el
// origen antes del corte final. Requiere ADMIN_TOKEN.
router.get("/cloudsql-status", requireAdmin, async (_req, res) => {
  const targetUrl = process.env.CLOUDSQL_DATABASE_URL;
  if (!targetUrl) {
    return res.status(400).json({ ok: false, message: "CLOUDSQL_DATABASE_URL no está configurado." });
  }
  const targetPool = makePool(targetUrl);
  try {
    const counts = {};
    for (const [table] of MIGRATION_ORDER) {
      const r = await targetPool.query(`SELECT COUNT(*)::int AS n FROM ${table}`).catch(() => ({ rows: [{ n: null }] }));
      counts[table] = r.rows[0].n;
    }
    return res.json({ ok: true, counts });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { message: err.message, code: err.code } });
  } finally {
    await targetPool.end().catch(() => {});
  }
});

// Emails de los super_admins iniciales. Los NOMBRES no son secretos; las
// CONTRASEÑAS nunca van en el código — se toman de process.env.RESET_ADMIN_PW.
const SUPERADMIN_SEED = [
  { email: "juandaniel.aguilar17@gmail.com", name: "Juandaniel Aguilar", id: "usr-juandaniel" },
  { email: "dropitcontacto@gmail.com",       name: "Dropit Contacto",    id: "usr-dropitcontacto" },
];

// ─── POST /api/_admin/seed-users ──────────────────────────────────────────────
// Crea o actualiza los super_admins iniciales usando la contraseña de la env var
// RESET_ADMIN_PW (NUNCA hardcodeada). Idempotente. Uso: tras deploy fresh o para
// recuperar acceso. Requiere ADMIN_TOKEN.
router.post("/seed-users", requireAdmin, async (_req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(400).json({ ok: false, message: "DATABASE_URL no set" });
  }
  const pw = process.env.RESET_ADMIN_PW;
  if (!pw) {
    return res.status(400).json({ ok: false, message: "RESET_ADMIN_PW no está configurado en el servidor." });
  }
  try {
    const dbMod = await import("../data/db.js");
    const results = [];
    for (const admin of SUPERADMIN_SEED) {
      const existing = await dbMod.findUserByEmail(admin.email);
      if (existing) {
        await dbMod.updateUser(existing.id, {
          email: admin.email,
          password: pw,
          role: "super_admin",
          isActive: true,
        });
        results.push({ email: admin.email, action: "updated", id: existing.id });
      } else {
        const created = await dbMod.createUser({
          id: admin.id,
          email: admin.email,
          name: admin.name,
          password: pw,
          role: "super_admin",
        });
        results.push({ email: admin.email, action: "created", id: created.id });
      }
    }
    return res.json({ ok: true, users: results, note: "Password = RESET_ADMIN_PW" });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: { message: err.message, code: err.code },
    });
  }
});

// ─── POST /api/_admin/reset-password ──────────────────────────────────────────
// Resetea la contraseña de un usuario. La NUEVA contraseña viene en el body (nunca
// en el código). Requiere ADMIN_TOKEN. Body: { email, newPassword, role? }.
router.post("/reset-password", requireAdmin, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(400).json({ ok: false, message: "DATABASE_URL no set" });
  }
  const { email, newPassword, role } = req.body || {};
  if (!email || !newPassword) {
    return res.status(400).json({ ok: false, message: "Faltan 'email' y 'newPassword'." });
  }
  try {
    const dbMod = await import("../data/db.js");
    const existing = await dbMod.findUserByEmail(String(email).toLowerCase().trim());
    if (existing) {
      await dbMod.updateUser(existing.id, {
        password: newPassword,
        isActive: true,
        ...(role ? { role } : {}),
      });
      return res.json({ ok: true, action: "updated", email: existing.email });
    }
    const created = await dbMod.createUser({
      email: String(email).toLowerCase().trim(),
      name: email.split("@")[0],
      password: newPassword,
      role: role || "super_admin",
    });
    return res.json({ ok: true, action: "created", email: created.email });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { message: err.message, code: err.code } });
  }
});

export default router;
