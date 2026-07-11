import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { saveStore, store } from "../data/store.js";
import * as db from "../data/db.js";

const HAS_DB = !!process.env.DATABASE_URL;

// ─── In-memory config ─────────────────────────────────────────────────────────
function loadFromStore() {
  return store.media?.gmailConfig || null;
}

const saved = loadFromStore();
let _cfg = {
  // Gmail OAuth2 (preferred)
  gmailUser:    env.gmailUser          || saved?.gmailUser    || "",
  clientId:     env.gmailClientId      || saved?.clientId     || "",
  clientSecret: env.gmailClientSecret  || saved?.clientSecret || "",
  refreshToken: env.gmailRefreshToken  || saved?.refreshToken || "",
  // SMTP App Password fallback
  smtpUser:     process.env.SMTP_USER  || "",
  smtpPass:     process.env.SMTP_PASS  || "",
  fromName:     env.smtpFrom           || saved?.fromName     || "DropIt Service",
};

if (HAS_DB) {
  db.getSetting("gmail")
    .then((dbCfg) => {
      if (!dbCfg) return;
      if (!env.gmailUser         && dbCfg.gmailUser)    _cfg.gmailUser    = dbCfg.gmailUser;
      if (!env.gmailClientId     && dbCfg.clientId)     _cfg.clientId     = dbCfg.clientId;
      if (!env.gmailClientSecret && dbCfg.clientSecret) _cfg.clientSecret = dbCfg.clientSecret;
      if (!env.gmailRefreshToken && dbCfg.refreshToken) _cfg.refreshToken = dbCfg.refreshToken;
      if (!env.smtpFrom          && dbCfg.fromName)     _cfg.fromName     = dbCfg.fromName;
    })
    .catch((err) => console.warn("[mail] no se pudo leer settings.gmail:", err.message));
}

// ─── Transport factory ────────────────────────────────────────────────────────
function _hasOAuth2() {
  return !!(
    (_cfg.gmailUser || _cfg.smtpUser) &&
    _cfg.clientId &&
    _cfg.clientSecret &&
    _cfg.refreshToken
  );
}

function _hasSmtp() {
  return !!(
    (_cfg.smtpUser || _cfg.gmailUser) &&
    _cfg.smtpPass
  );
}

function createTransport() {
  if (_hasOAuth2()) {
    console.log("[mail] usando Gmail OAuth2");
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: _cfg.gmailUser || _cfg.smtpUser,
        clientId: _cfg.clientId,
        clientSecret: _cfg.clientSecret,
        refreshToken: _cfg.refreshToken,
      },
    });
  }
  // Fallback: Gmail App Password via SMTP
  console.log("[mail] usando Gmail SMTP (App Password)");
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: _cfg.smtpUser || _cfg.gmailUser,
      pass: _cfg.smtpPass,
    },
    family: 4,
    tls: { servername: "smtp.gmail.com", minVersion: "TLSv1.2" },
    connectionTimeout: 15_000,
    greetingTimeout:   10_000,
    socketTimeout:     20_000,
  });
}

export function isMailConfigured() {
  return _hasOAuth2() || _hasSmtp();
}

export async function sendMail({ to, subject, html, text, attachments = [] }) {
  if (!isMailConfigured()) {
    const err = new Error(
      "Correo no configurado. Agrega GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET + GMAIL_REFRESH_TOKEN (OAuth2) " +
      "o SMTP_USER + SMTP_PASS (App Password) en las variables de entorno."
    );
    console.error("[mail] cannot send to", to, "→", err.message);
    throw err;
  }
  const fromEmail = _cfg.gmailUser || _cfg.smtpUser;
  const transporter = createTransport();
  console.log("[mail] → enviando a:", to, "· asunto:", subject);
  try {
    const info = await transporter.sendMail({
      from: `"${_cfg.fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
      text,
      attachments,
    });
    console.log("[mail] ✓ enviado a", to, "·", info.messageId);
    return info;
  } catch (err) {
    console.error("[mail] ✗ error enviando a", to, "·", err.message);
    throw err;
  }
}

export async function testConnection() {
  const transporter = createTransport();
  await transporter.verify();
  return { ok: true, provider: _hasOAuth2() ? "gmail-oauth2" : "gmail-smtp" };
}

export async function updateSmtpConfig({ gmailUser, clientId, clientSecret, refreshToken, fromName }) {
  if (gmailUser     !== undefined) _cfg.gmailUser    = gmailUser;
  if (clientId      !== undefined) _cfg.clientId     = clientId;
  if (clientSecret  !== undefined) _cfg.clientSecret = clientSecret;
  if (refreshToken  !== undefined) _cfg.refreshToken = refreshToken;
  if (fromName      !== undefined) _cfg.fromName     = fromName;

  if (HAS_DB) {
    try { await db.setSetting("gmail", { ..._cfg }); }
    catch (err) { console.warn("[mail] no se pudo persistir settings.gmail:", err.message); }
  }
  if (!store.media) store.media = {};
  store.media.gmailConfig = { ..._cfg };
  saveStore();
}

export function getSmtpConfig() {
  return { ..._cfg };
}

export function getSmtpConfigPublic() {
  return {
    gmailUser:   _cfg.gmailUser  || _cfg.smtpUser || null,
    fromName:    _cfg.fromName   || null,
    provider:    _hasOAuth2() ? "gmail-oauth2" : (_hasSmtp() ? "gmail-smtp" : "none"),
    configured:  isMailConfigured(),
    hasClientId: !!_cfg.clientId,
    hasSecret:   !!_cfg.clientSecret,
    hasToken:    !!_cfg.refreshToken,
    hasSmtpPass: !!_cfg.smtpPass,
  };
}

export function getActiveProvider() {
  return {
    provider: _hasOAuth2() ? "gmail-oauth2" : "gmail-smtp",
    user: _cfg.gmailUser || _cfg.smtpUser || null,
    configured: isMailConfigured(),
  };
}

export function getOperatorInbox() {
  return process.env.OPERATOR_EMAIL || _cfg.gmailUser || _cfg.smtpUser || "";
}
