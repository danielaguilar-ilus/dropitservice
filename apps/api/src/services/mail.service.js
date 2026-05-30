import nodemailer from "nodemailer";
import { Resend } from "resend";
import { env } from "../config/env.js";
import { saveStore, store } from "../data/store.js";
import * as db from "../data/db.js";

const HAS_DB = !!process.env.DATABASE_URL;

// ─── Resend (HTTPS API — bypasses port 587 blocked by Railway) ───────────────
// Sign up free at https://resend.com — 3000 emails/mes + 100/día sin tarjeta.
// Set RESEND_API_KEY in Railway. Optional: RESEND_FROM (default = SMTP_USER).
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM    = process.env.RESEND_FROM    || "";
const _resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
if (_resend) {
  console.log("[mail] Resend habilitado — usando HTTPS API");
} else {
  console.log("[mail] Resend NO configurado — fallback a SMTP (puede fallar en Railway por puerto 587 bloqueado)");
}

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

// ─── Resend HTTPS sender — preferred path when RESEND_API_KEY is set ─────────
async function sendViaResend({ to, subject, html, text, attachments }) {
  // Resend requires a verified sender domain OR onboarding@resend.dev for free
  // tier testing. We default to onboarding@resend.dev if RESEND_FROM not set —
  // this works immediately but emails arrive as "via resend.dev".
  // For production: verify your domain in Resend dashboard + set RESEND_FROM.
  const fromAddress = RESEND_FROM
    || `${_cfg.fromName} <onboarding@resend.dev>`;

  console.log("[mail/resend] → enviando a:", to, "· from:", fromAddress, "· asunto:", subject);
  const payload = {
    from: fromAddress,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text,
  };
  if (attachments && attachments.length > 0) {
    payload.attachments = attachments.map(a => ({
      filename: a.filename,
      content: a.content,
    }));
  }
  const { data, error } = await _resend.emails.send(payload);
  if (error) {
    console.error("[mail/resend] ✗ Resend API error:", error);
    const err = new Error(error.message || "Resend API error");
    err.code = error.name || "RESEND_ERROR";
    err.statusCode = error.statusCode;
    err.fullError = error;
    throw err;
  }
  console.log("[mail/resend] ✓ enviado · id:", data?.id);
  return {
    messageId: data?.id || `resend-${Date.now()}`,
    response: "250 OK via Resend",
    accepted: [to],
    rejected: [],
    pending: [],
    envelope: { from: fromAddress, to: [to] },
    provider: "resend",
  };
}

export async function sendMail({ to, subject, html, text, attachments = [] }) {
  // ─── 1. Try Resend first if configured (preferred — works on Railway) ──────
  if (_resend) {
    try {
      return await sendViaResend({ to, subject, html, text, attachments });
    } catch (resendErr) {
      console.warn("[mail] Resend falló, intentando fallback SMTP:", resendErr.message);
      // Only fall through to SMTP if it's an API/quota error, not auth.
      // If SMTP is also broken (Railway port 587 blocked), this will fail too.
      if (resendErr.statusCode === 401 || resendErr.statusCode === 403) {
        // Bad API key — don't waste time on SMTP either; surface clearly.
        throw resendErr;
      }
      // Continue to SMTP fallback for transient API errors.
    }
  }

  // ─── 2. Fallback to SMTP (legacy path) ─────────────────────────────────────
  if (!_cfg.host || !_cfg.user || !_cfg.pass) {
    const missing = [
      !_cfg.host && "SMTP_HOST",
      !_cfg.user && "SMTP_USER",
      !_cfg.pass && "SMTP_PASS",
    ].filter(Boolean).join(", ");
    const err = new Error(`Ni Resend ni SMTP están configurados · SMTP faltan: ${missing}. Configura RESEND_API_KEY en Railway (recomendado)`);
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
  // If Resend is configured, verify by listing API keys (lightest possible call)
  if (_resend) {
    try {
      // Resend doesn't have a dedicated ping endpoint; we attempt a domains
      // list which validates the API key without consuming the email quota.
      await _resend.domains.list();
      return { ok: true, provider: "resend" };
    } catch (err) {
      console.error("[mail/resend] testConnection falló:", err.message);
      throw err;
    }
  }
  // SMTP fallback
  const transporter = createTransport();
  await transporter.verify();
  return { ok: true, provider: "smtp" };
}

// Public helper for the diagnostic UI — tells operator which provider is active
export function getActiveProvider() {
  if (_resend) return { provider: "resend", apiKeyLen: RESEND_API_KEY.length, fromConfigured: !!RESEND_FROM };
  return { provider: "smtp", host: _cfg.host, port: _cfg.port, user: _cfg.user };
}

// True si HAY algún proveedor de correo capaz de enviar (Resend O SMTP completo).
// Los handlers deben usar esto en lugar de chequear sólo SMTP — así Resend
// funciona aunque no exista configuración SMTP.
export function isMailConfigured() {
  if (_resend) return true;
  return !!(_cfg.host && _cfg.user && _cfg.pass);
}

// Dirección "from" efectiva — usada como destino por defecto de notificaciones
// internas al operador cuando no hay una bandeja de operador explícita.
export function getOperatorInbox() {
  return process.env.OPERATOR_EMAIL || _cfg.user || RESEND_FROM || "";
}
