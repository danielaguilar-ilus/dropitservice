import { Router } from "express";
import { sendMail, testConnection, updateSmtpConfig, getSmtpConfig } from "../services/mail.service.js";

const router = Router();

// ─── GET current config (without password) ───────────────────────────────────
router.get("/config", (req, res) => {
  const cfg = getSmtpConfig();
  res.json({ ok: true, config: { ...cfg, pass: cfg.pass ? "••••••••" : "" } });
});

// ─── GET health — does SMTP have all required fields? ────────────────────────
router.get("/health", (req, res) => {
  const cfg = getSmtpConfig();
  const configured = !!(cfg.host && cfg.user && cfg.pass);
  res.json({
    ok: true,
    configured,
    host: cfg.host || null,
    user: cfg.user ? `${cfg.user.split("@")[0]}@***` : null,
    hasPassword: !!cfg.pass,
    fromName: cfg.fromName || null,
    source: cfg.pass ? "configured" : "missing",
  });
});

// ─── POST update config ───────────────────────────────────────────────────────
router.post("/config", (req, res) => {
  const { host, port, secure, user, pass, fromName } = req.body;
  updateSmtpConfig({ host, port, secure, user, pass, fromName });
  res.json({ ok: true, message: "Configuración SMTP actualizada." });
});

// ─── POST test connection ─────────────────────────────────────────────────────
router.post("/test", async (req, res) => {
  const TIMEOUT_MS = 10_000;
  const timeoutPromise = new Promise((_, rej) =>
    setTimeout(
      () => rej(new Error(`Sin respuesta del servidor SMTP en ${TIMEOUT_MS / 1000}s. Verifica host, puerto y credenciales.`)),
      TIMEOUT_MS,
    )
  );
  try {
    await Promise.race([testConnection(), timeoutPromise]);
    res.json({ ok: true, message: "Conexión SMTP verificada correctamente." });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
});

// ─── POST send email ──────────────────────────────────────────────────────────
router.post("/send", async (req, res) => {
  const { to, subject, html, text, attachments } = req.body;
  if (!to || !subject) {
    return res.status(400).json({ message: "Campos 'to' y 'subject' son requeridos." });
  }
  try {
    const info = await sendMail({ to, subject, html, text, attachments });
    res.json({ ok: true, messageId: info.messageId });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

export default router;
