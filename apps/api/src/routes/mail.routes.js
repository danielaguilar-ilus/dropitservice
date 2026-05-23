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

// ─── GET diagnostic test-send — full Nodemailer detail in JSON response ──────
// Usage: /api/mail/test-send?to=your-email@gmail.com
// Defaults to SMTP_USER if no `to` provided. Returns full error stack on failure.
router.get("/test-send", async (req, res) => {
  const startedAt = Date.now();
  const cfg = getSmtpConfig();
  const to = (req.query.to && String(req.query.to)) || cfg.user;
  const config = {
    host: cfg.host || null,
    port: cfg.port || null,
    secure: !!cfg.secure,
    user: cfg.user || null,
    fromName: cfg.fromName || null,
    hasPassword: !!cfg.pass,
    passwordLen: cfg.pass ? cfg.pass.length : 0,
  };
  if (!to) {
    return res.status(400).json({
      ok: false,
      duration_ms: Date.now() - startedAt,
      config,
      error: { message: "No 'to' destination provided and SMTP_USER is empty." },
    });
  }
  const subject = `[Dropit Diagnostic] Test send · ${new Date().toISOString()}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:24px auto;padding:24px;border:1px solid #eee;border-radius:10px">
      <h2 style="color:#f97316;margin:0 0 12px">Dropit · diagnóstico SMTP</h2>
      <p>Si recibes este correo, el envío SMTP desde Railway funciona correctamente.</p>
      <ul style="font-size:13px;color:#555">
        <li><b>Host:</b> ${config.host}</li>
        <li><b>Puerto:</b> ${config.port}</li>
        <li><b>User:</b> ${config.user}</li>
        <li><b>Generado:</b> ${new Date().toLocaleString("es-CL")}</li>
      </ul>
    </div>`;
  const text = `Dropit diagnostic test send · host=${config.host} port=${config.port} user=${config.user} · sent ${new Date().toISOString()}`;

  try {
    const info = await sendMail({ to, subject, html, text });
    return res.json({
      ok: true,
      duration_ms: Date.now() - startedAt,
      config,
      to,
      subject,
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
      rejected: info.rejected,
      pending: info.pending,
      envelope: info.envelope,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      duration_ms: Date.now() - startedAt,
      config,
      to,
      subject,
      error: {
        message: err.message,
        code: err.code || null,
        command: err.command || null,
        response: err.response || null,
        responseCode: err.responseCode || null,
        errno: err.errno || null,
        syscall: err.syscall || null,
        address: err.address || null,
        port: err.port || null,
        stack: err.stack || null,
      },
    });
  }
});

export default router;
