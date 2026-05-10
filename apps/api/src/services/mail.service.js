import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = path.join(__dirname, "../../smtp-config.json");

// ─── Load persisted config (survives server restarts) ────────────────────────
function loadPersistedConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    }
  } catch { /* ignore */ }
  return null;
}

function persistConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf8");
  } catch { /* ignore */ }
}

// ─── In-memory config — initialized from file, then .env as fallback ─────────
const saved = loadPersistedConfig();
let _cfg = {
  host:     saved?.host     || env.smtpHost,
  port:     saved?.port     || env.smtpPort,
  secure:   saved?.secure   ?? env.smtpSecure,
  user:     saved?.user     || env.smtpUser,
  pass:     saved?.pass     || env.smtpPass,
  fromName: saved?.fromName || env.smtpFrom,
};

export function updateSmtpConfig({ host, port, secure, user, pass, fromName }) {
  if (host !== undefined)   _cfg.host     = host;
  if (port !== undefined)   _cfg.port     = Number(port);
  if (secure !== undefined) _cfg.secure   = secure;
  if (user !== undefined)   _cfg.user     = user;
  if (pass !== undefined)   _cfg.pass     = pass;
  if (fromName !== undefined) _cfg.fromName = fromName;
  persistConfig(_cfg); // ← save to file immediately
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
  const transporter = createTransport();
  return transporter.sendMail({
    from: `"${_cfg.fromName}" <${_cfg.user}>`,
    to,
    subject,
    html,
    text,
    attachments,
  });
}

export async function testConnection() {
  const transporter = createTransport();
  await transporter.verify();
}
