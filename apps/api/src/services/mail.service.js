import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { saveStore, store } from "../data/store.js";

// ─── In-memory config — priority: env vars > db.json > defaults ──────────────
// In Railway: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM as
// environment variables for permanent persistence across deploys.

function loadFromStore() {
  return store.media?.smtpConfig || null;
}

const saved = loadFromStore();
let _cfg = {
  host:     env.smtpHost     || saved?.host     || "smtp.gmail.com",
  port:     env.smtpPort     || saved?.port     || 587,
  secure:   env.smtpSecure   ?? saved?.secure   ?? false,
  user:     env.smtpUser     || saved?.user     || "",
  pass:     env.smtpPass     || saved?.pass     || "",
  fromName: env.smtpFrom     || saved?.fromName || "DropIt Service",
};

export function updateSmtpConfig({ host, port, secure, user, pass, fromName }) {
  if (host !== undefined)     _cfg.host     = host;
  if (port !== undefined)     _cfg.port     = Number(port);
  if (secure !== undefined)   _cfg.secure   = secure;
  if (user !== undefined)     _cfg.user     = user;
  if (pass !== undefined)     _cfg.pass     = pass;
  if (fromName !== undefined) _cfg.fromName = fromName;
  // Persist to db.json so it survives restarts (but env vars take priority on next boot)
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
    return info;
  } catch (err) {
    console.error("[mail] ✗ failed to", to, "·", err.message);
    throw err;
  }
}

export async function testConnection() {
  const transporter = createTransport();
  await transporter.verify();
}
