import { Router } from "express";
import {
  sendMail,
  testConnection,
  updateSmtpConfig,
  getSmtpConfig,
  getSmtpConfigPublic,
  getActiveProvider,
  isMailConfigured,
} from "../services/mail.service.js";

const router = Router();

// ─── GET current config (masked — no secrets exposed) ────────────────────────
router.get("/config", (req, res) => {
  res.json({ ok: true, config: getSmtpConfigPublic() });
});

// Autoriza solo a super_admin (o al ADMIN_TOKEN). El middleware requireAuthorized
// deja al usuario en req.actor y marca req.authVia="admin_token" si vino por token.
function isSuperAdmin(req) {
  return req.authVia === "admin_token" || req.actor?.role === "super_admin";
}

// ─── GET full config — super_admin only ──────────────────────────────────────
router.get("/config/full", (req, res) => {
  if (!isSuperAdmin(req)) {
    return res.status(403).json({ ok: false, message: "Solo superadmin puede ver esta configuración." });
  }
  const cfg = getSmtpConfig();
  res.json({
    ok: true,
    config: {
      gmailUser:    cfg.gmailUser    || "",
      clientId:     cfg.clientId     || "",
      clientSecret: cfg.clientSecret ? "••••••••" : "",
      refreshToken: cfg.refreshToken ? "••••••••" : "",
      fromName:     cfg.fromName     || "",
      hasClientId:  !!cfg.clientId,
      hasSecret:    !!cfg.clientSecret,
      hasToken:     !!cfg.refreshToken,
    },
  });
});

// ─── GET health ───────────────────────────────────────────────────────────────
router.get("/health", (req, res) => {
  const active = getActiveProvider();
  res.json({
    ok: true,
    activeProvider: active.provider,
    configured: active.configured,
    user: active.user ? `${active.user.split("@")[0]}@***` : null,
  });
});

// ─── POST update config — super_admin only ───────────────────────────────────
router.post("/config", async (req, res) => {
  if (!isSuperAdmin(req)) {
    return res.status(403).json({ ok: false, message: "Solo superadmin puede modificar esta configuración." });
  }
  try {
    const { gmailUser, clientId, clientSecret, refreshToken, fromName } = req.body;
    await updateSmtpConfig({ gmailUser, clientId, clientSecret, refreshToken, fromName });
    res.json({ ok: true, message: "Configuración Gmail API actualizada." });
  } catch (err) {
    console.error("[mail/config POST] error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ─── POST test connection ─────────────────────────────────────────────────────
router.post("/test", async (req, res) => {
  const TIMEOUT_MS = 12_000;
  const timeoutPromise = new Promise((_, rej) =>
    setTimeout(() => rej(new Error(`Sin respuesta de Gmail en ${TIMEOUT_MS / 1000}s.`)), TIMEOUT_MS)
  );
  try {
    await Promise.race([testConnection(), timeoutPromise]);
    res.json({ ok: true, message: "Conexión Gmail API verificada correctamente." });
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

// ─── GET diagnostic test-send ─────────────────────────────────────────────────
router.get("/test-send", async (req, res) => {
  const startedAt = Date.now();
  const cfg = getSmtpConfigPublic();
  const to = (req.query.to && String(req.query.to)) || cfg.gmailUser;
  if (!to) {
    return res.status(400).json({ ok: false, error: { message: "No 'to' provided and GMAIL_USER is empty." } });
  }
  const subject = `[Dropit Diagnostic] Test send · ${new Date().toISOString()}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:24px auto;padding:24px;border:1px solid #eee;border-radius:10px">
      <h2 style="color:#f97316;margin:0 0 12px">Dropit · diagnóstico Gmail API</h2>
      <p>Si recibes este correo, Gmail API OAuth2 está funcionando correctamente.</p>
      <ul style="font-size:13px;color:#555">
        <li><b>Cuenta:</b> ${cfg.gmailUser}</li>
        <li><b>Proveedor:</b> Gmail OAuth2</li>
        <li><b>Generado:</b> ${new Date().toLocaleString("es-CL")}</li>
      </ul>
    </div>`;
  try {
    const info = await sendMail({ to, subject, html, text: "Dropit diagnostic test via Gmail API." });
    return res.json({ ok: true, duration_ms: Date.now() - startedAt, to, subject, messageId: info.messageId });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      duration_ms: Date.now() - startedAt,
      to,
      error: { message: err.message, code: err.code || null, stack: err.stack || null },
    });
  }
});

export default router;
