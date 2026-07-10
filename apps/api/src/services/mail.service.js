import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { saveStore, store } from "../data/store.js";
import * as db from "../data/db.js";

const HAS_DB = !!process.env.DATABASE_URL;

// ─── In-memory config — priority: env vars > DB > db.json > defaults ─────────
function loadFromStore() {
  return store.media?.gmailConfig || null;
}

const saved = loadFromStore();
let _cfg = {
  gmailUser:      env.gmailUser      || saved?.gmailUser      || "",
  clientId:       env.gmailClientId  || saved?.clientId       || "",
  clientSecret:   env.gmailClientSecret || saved?.clientSecret || "",
  refreshToken:   env.gmailRefreshToken || saved?.refreshToken  || "",
  fromName:       env.smtpFrom       || saved?.fromName       || "DropIt Service",
};

// Hidrata desde DB en background
if (HAS_DB) {
  db.getSetting("gmail")
    .then((dbCfg) => {
      if (!dbCfg) return;
      if (!env.gmailUser         && dbCfg.gmailUser)      _cfg.gmailUser      = dbCfg.gmailUser;
      if (!env.gmailClientId     && dbCfg.clientId)       _cfg.clientId       = dbCfg.clientId;
      if (!env.gmailClientSecret && dbCfg.clientSecret)   _cfg.clientSecret   = dbCfg.clientSecret;
      if (!env.gmailRefreshToken && dbCfg.refreshToken)   _cfg.refreshToken   = dbCfg.refreshToken;
      if (!env.smtpFrom          && dbCfg.fromName)       _cfg.fromName       = dbCfg.fromName;
      console.log("[mail] config Gmail hidratada desde settings.gmail");
    })
    .catch((err) => console.warn("[mail] no se pudo leer settings.gmail:", err.message));
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

function createTransport() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: _cfg.gmailUser,
      clientId: _cfg.clientId,
      clientSecret: _cfg.clientSecret,
      refreshToken: _cfg.refreshToken,
    },
  });
}

export async function sendMail({ to, subject, html, text, attachments = [] }) {
  if (!_cfg.gmailUser || !_cfg.clientId || !_cfg.clientSecret || !_cfg.refreshToken) {
    const missing = [
      !_cfg.gmailUser    && "GMAIL_USER",
      !_cfg.clientId     && "GMAIL_CLIENT_ID",
      !_cfg.clientSecret && "GMAIL_CLIENT_SECRET",
      !_cfg.refreshToken && "GMAIL_REFRESH_TOKEN",
    ].filter(Boolean).join(", ");
    const err = new Error(`Gmail API no configurado — faltan: ${missing}`);
    console.error("[mail] cannot send to", to, "→", err.message);
    throw err;
  }

  const transporter = createTransport();
  console.log("[mail] → enviando via Gmail API a:", to, "· asunto:", subject);

  try {
    const info = await transporter.sendMail({
      from: `"${_cfg.fromName}" <${_cfg.gmailUser}>`,
      to,
      subject,
      html,
      text,
      attachments,
    });
    console.log("[mail] ✓ enviado a", to, "·", info.messageId);
    return info;
  } catch (err) {
    console.error("[mail] ✗ Gmail error a", to, "·", err.message);
    throw err;
  }
}

export async function testConnection() {
  const transporter = createTransport();
  await transporter.verify();
  return { ok: true, provider: "gmail-oauth2" };
}

export function getSmtpConfigPublic() {
  return {
    gmailUser:    _cfg.gmailUser    || null,
    fromName:     _cfg.fromName     || null,
    hasClientId:  !!_cfg.clientId,
    hasSecret:    !!_cfg.clientSecret,
    hasToken:     !!_cfg.refreshToken,
  };
}

export function getActiveProvider() {
  return {
    provider: "gmail-oauth2",
    user: _cfg.gmailUser || null,
    configured: isMailConfigured(),
  };
}

export function isMailConfigured() {
  return !!(
    _cfg.gmailUser &&
    _cfg.clientId &&
    _cfg.clientSecret &&
    _cfg.refreshToken
  );
}

export function getOperatorInbox() {
  return process.env.OPERATOR_EMAIL || _cfg.gmailUser || "";
}
