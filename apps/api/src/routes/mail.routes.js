import { Router } from "express";
import { sendMail, testConnection, updateSmtpConfig, getSmtpConfig } from "../services/mail.service.js";

const router = Router();

// ─── GET current config (without password) ───────────────────────────────────
router.get("/config", (req, res) => {
  const cfg = getSmtpConfig();
  res.json({ ok: true, config: { ...cfg, pass: cfg.pass ? "••••••••" : "" } });
});

// ─── POST update config ───────────────────────────────────────────────────────
router.post("/config", (req, res) => {
  const { host, port, secure, user, pass, fromName } = req.body;
  updateSmtpConfig({ host, port, secure, user, pass, fromName });
  res.json({ ok: true, message: "Configuración SMTP actualizada." });
});

// ─── POST test connection ─────────────────────────────────────────────────────
router.post("/test", async (req, res) => {
  try {
    await testConnection();
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
