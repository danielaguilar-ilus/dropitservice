import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { saveStore, store } from "../data/store.js";
import * as db from "../data/db.js";

const HAS_DB = !!process.env.DATABASE_URL;

// ─── In-memory config — priority: env vars > DB > db.json > defaults ─────────
// In Railway: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM as
// environment variables for permanent persistence across deploys.

function loadFromStore() {
  return store.media?.smtpConfig || null;
}

// Bootstrap config sincrónicamente con env vars + store fallback.
// Si HAS_DB, intentamos hidratar desde Postgres en background.
const saved = loadFromStore();
let _cfg = {
  host:     env.smtpHost     || saved?.host     || "smtp.gmail.com",
  port:     env.smtpPort     || saved?.port     || 587,
  secure:   env.smtpSecure   ?? saved?.secure   ?? false,
  user:     env.smtpUser     || saved?.user     || "",
  pass:     env.smtpPass     || saved?.pass     || "",
  fromName: env.smtpFrom     || saved?.fromName || "DropIt Service",
};

// Hidrata desde DB en background (no bloquea el module load).
// Solo aplica los valores faltantes (env vars siguen ganando).
if (HAS_DB) {
  db.getSetting("smtp")
    .then((dbCfg) => {
      if (!dbCfg) return;
      if (!env.smtpHost && dbCfg.host)         _cfg.host     = dbCfg.host;
      if (!env.smtpPort && dbCfg.port)         _cfg.port     = dbCfg.port;
      if (env.smtpSecure === undefined && dbCfg.secure !== undefined) _cfg.secure = dbCfg.secure;
      if (!env.smtpUser && dbCfg.user)         _cfg.user     = dbCfg.user;
      if (!env.smtpPass && dbCfg.pass)         _cfg.pass     = dbCfg.pass;
      if (!env.smtpFrom && dbCfg.fromName)     _cfg.fromName = dbCfg.fromName;
      console.log("[mail] config hidratada desde settings.smtp");
    })
    .catch((err) => console.warn("[mail] no se pudo leer settings.smtp:", err.message));
}

export async function updateSmtpConfig({ host, port, secure, user, pass, fromName }) {
  if (host !== undefined)     _cfg.host     = host;
  if (port !== undefined)     _cfg.port     = Number(port);
  if (secure !== undefined)   _cfg.secure   = secure;
  if (user !== undefined)     _cfg.user     = user;
  if (pass !== undefined)     _cfg.pass     = pass;
  if (fromName !== undefined) _cfg.fromName = fromName;

  // Persist to DB if available
  if (HAS_DB) {
    try {
      await db.setSetting("smtp", { ..._cfg });
    } catch (err) {
      console.warn("[mail] no se pudo persistir settings.smtp:", err.message);
    }
  }

  // Always also persist to store/db.json para mantener compatibilidad
  // durante la transición (y por si DATABASE_URL desaparece después)
  if (!store.media) store.media = {};
  store.media.smtpConfig = { ..._cfg };
  saveStore();
}

export function getSmtpConfig() {
  return { ..._cfg };
}

function createTransport() {
  return nodemailer.createTransport({
    host: _cfg.host,
    port: _cfg.port,
    secure: _cfg.secure,
    auth: {
      user: _cfg.user,
      pass: _cfg.pass,
    },
    // ─── Force IPv4 ────────────────────────────────────────────────────────────
    // Railway's outbound IPv6 to Gmail times out with ENETUNREACH on
    // 2607:f8b0:...:587. Forcing family=4 + tls.servername fixes it.
    family: 4,
    tls: { servername: _cfg.host, minVersion: "TLSv1.2" },
    connectionTimeout: 10_000,
    greetingTimeout:   10_000,
    socketTimeout:     20_000,
  });
}

export async function sendMail({ to, subject, html, text, attachments = [] }) {
  // Early diagnostics — fail fast with a clear message
  if (!_cfg.host || !_cfg.user || !_cfg.pass) {
    const missing = [
      !_cfg.host && "SMTP_HOST",
      !_cfg.user && "SMTP_USER",
      !_cfg.pass && "SMTP_PASS",
    ].filter(Boolean).join(", ");
    const err = new Error(`SMTP no configurado · faltan: ${missing}`);
    console.error("[mail] cannot send to", to, "→", err.message);
    throw err;
  }
  const transporter = createTransport();
  // Verbose logging — dump transporter config (without password) before send
  console.log("[mail] → transporter.options:", {
    host: _cfg.host,
    port: _cfg.port,
    secure: _cfg.secure,
    user: _cfg.user,
    passLen: _cfg.pass ? _cfg.pass.length : 0,
    fromName: _cfg.fromName,
  });
  console.log("[mail] → enviando a:", to, "· asunto:", subject);
  try {
    const info = await transporter.sendMail({
      from: `"${_cfg.fromName}" <${_cfg.user}>`,
      to,
      subject,
      html,
      text,
      attachments,
    });
    console.log("[mail] ✓ sent to", to, "·", subject, "·", info.messageId);
    console.log("[mail] ✓ Nodemailer response:", {
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
      rejected: info.rejected,
      pending: info.pending,
      envelope: info.envelope,
    });
    return info;
  } catch (err) {
    console.error("[mail] ✗ failed to", to, "·", err.message);
    console.error("[mail] ✗ Nodemailer error details:", {
      message: err.message,
      code: err.code,
      command: err.command,
      response: err.response,
      responseCode: err.responseCode,
      errno: err.errno,
      syscall: err.syscall,
      address: err.address,
      port: err.port,
      stack: err.stack,
    });
    throw err;
  }
}

export async function testConnection() {
  const transporter = createTransport();
  await transporter.verify();
}
