/**
 * Users routes — CRUD para gestión de usuarios desde el panel.
 * ────────────────────────────────────────────────────────────
 * Requiere DATABASE_URL (Postgres) — todas las acciones son async.
 * Autenticación: header `X-User-Email` identifica al actor.
 *  - Listar / crear / editar / desactivar: sólo super_admin
 *  - Cambiar password: el propio usuario o un super_admin
 */
import { Router } from "express";
import * as db from "../data/db.js";

const router = Router();
const HAS_DB = !!process.env.DATABASE_URL;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripPassword(user) {
  if (!user) return user;
  const { passwordHash, password_hash, ...safe } = user;
  return safe;
}

function ensureHasDb(res) {
  if (HAS_DB) return true;
  res.status(503).json({ message: "Postgres no está configurado en este entorno" });
  return false;
}

async function loadActor(req) {
  const actorEmail = req.headers["x-user-email"];
  if (!actorEmail) return { error: { status: 401, message: "Falta header X-User-Email" } };
  const actor = await db.findUserByEmail(actorEmail);
  if (!actor) return { error: { status: 401, message: "Usuario actor no encontrado" } };
  return { actor };
}

// Middleware: sólo super_admin
function requireSuperAdmin(req, res, next) {
  if (!ensureHasDb(res)) return;
  (async () => {
    const { actor, error } = await loadActor(req);
    if (error) return res.status(error.status).json({ message: error.message });
    if (actor.role !== "super_admin") {
      return res.status(403).json({ message: "Solo super_admin" });
    }
    req.actor = actor;
    next();
  })().catch(next);
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

router.get("/", requireSuperAdmin, async (_req, res) => {
  try {
    const users = await db.listUsers();
    res.json({ users: users.map(stripPassword) });
  } catch (err) {
    console.error("[users/list] error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/", requireSuperAdmin, async (req, res) => {
  try {
    const { email, name, password, role } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Faltan email o password" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password debe tener al menos 6 caracteres" });
    }
    const normalizedEmail = String(email).toLowerCase().trim();
    const exists = await db.findUserByEmail(normalizedEmail);
    if (exists) {
      return res.status(409).json({ message: "Ya existe un usuario con ese email" });
    }
    const id = `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const user = await db.createUser({
      id,
      email: normalizedEmail,
      name: name || normalizedEmail,
      password,
      role: role || "operator",
    });
    res.status(201).json({ user: stripPassword(user) });
  } catch (err) {
    console.error("[users/create] error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.patch("/:id", requireSuperAdmin, async (req, res) => {
  try {
    const target = await db.findUser(req.params.id);
    if (!target) return res.status(404).json({ message: "Usuario no encontrado" });

    const { name, role, isActive, email } = req.body || {};
    const updates = {};
    if (name !== undefined)     updates.name = name;
    if (role !== undefined)     updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;
    if (email !== undefined)    updates.email = String(email).toLowerCase().trim();

    const updated = await db.updateUser(req.params.id, updates);
    res.json({ user: stripPassword(updated) });
  } catch (err) {
    console.error("[users/update] error:", err);
    res.status(500).json({ message: err.message });
  }
});

// Cambiar password — el propio usuario o un super_admin
router.patch("/:id/password", async (req, res) => {
  if (!ensureHasDb(res)) return;
  try {
    const { actor, error } = await loadActor(req);
    if (error) return res.status(error.status).json({ message: error.message });

    const target = await db.findUser(req.params.id);
    if (!target) return res.status(404).json({ message: "Usuario no encontrado" });

    if (actor.id !== target.id && actor.role !== "super_admin") {
      return res.status(403).json({ message: "Solo puedes cambiar tu propia password" });
    }

    const { newPassword } = req.body || {};
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "newPassword debe tener al menos 6 caracteres" });
    }

    await db.updateUser(req.params.id, { password: newPassword });
    res.json({ ok: true });
  } catch (err) {
    console.error("[users/password] error:", err);
    res.status(500).json({ message: err.message });
  }
});

// "Eliminar" = desactivar (soft delete)
router.delete("/:id", requireSuperAdmin, async (req, res) => {
  try {
    const target = await db.findUser(req.params.id);
    if (!target) return res.status(404).json({ message: "Usuario no encontrado" });
    if (target.id === req.actor.id) {
      return res.status(400).json({ message: "No puedes desactivarte a ti mismo" });
    }
    await db.updateUser(req.params.id, { isActive: false });
    res.json({ ok: true });
  } catch (err) {
    console.error("[users/delete] error:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
