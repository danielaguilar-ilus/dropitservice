/**
 * auth.js — middleware de autorización para endpoints sensibles.
 * ─────────────────────────────────────────────────────────────
 * Autoriza una petición si CUALQUIERA de estas condiciones se cumple:
 *   1. Header `X-Admin-Token` (o query `?token=`) coincide con ADMIN_TOKEN.
 *   2. Header `X-User-Email` corresponde a un usuario activo con rol
 *      `admin` o `super_admin` (requiere DATABASE_URL).
 *
 * Usar en /api/mail/*, /api/whatsapp/* y /_admin/* para que NINGÚN endpoint
 * público pueda configurar correo, enviar mensajes ni tocar la base.
 */
import * as db from "../data/db.js";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const HAS_DB = !!process.env.DATABASE_URL;
const ADMIN_ROLES = new Set(["admin", "super_admin"]);

export function requireAuthorized(req, res, next) {
  (async () => {
    // 1) Token de administración (scripts, diagnóstico, automatización)
    const token = req.query.token || req.headers["x-admin-token"];
    if (ADMIN_TOKEN && token && token === ADMIN_TOKEN) {
      req.authVia = "admin_token";
      return next();
    }

    // 2) Sesión de usuario admin/super_admin identificada por email
    const email = req.headers["x-user-email"];
    if (email && HAS_DB) {
      try {
        const user = await db.findUserByEmail(String(email).toLowerCase().trim());
        if (user && user.isActive !== false && ADMIN_ROLES.has(user.role)) {
          req.actor = user;
          req.authVia = "user";
          return next();
        }
      } catch (err) {
        console.error("[auth] error validando actor:", err.message);
      }
    }

    return res.status(401).json({
      message: "No autorizado. Requiere ADMIN_TOKEN (header X-Admin-Token o ?token=) o sesión de administrador (header X-User-Email).",
    });
  })().catch(next);
}

// Variante estricta: SOLO ADMIN_TOKEN (para /_admin/* de migración/seed,
// que no deben depender de que exista un usuario en DB todavía).
export function requireAdminToken(req, res, next) {
  const token = req.query.token || req.headers["x-admin-token"];
  if (!ADMIN_TOKEN) {
    return res.status(503).json({ message: "ADMIN_TOKEN no está configurado en el servidor." });
  }
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ message: "Token admin requerido. Pasa ?token=... o header X-Admin-Token." });
  }
  next();
}
