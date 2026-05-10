import { Router } from "express";
import { sendWhatsApp } from "../services/whatsapp.service.js";

const router = Router();

// POST /api/whatsapp/send
router.post("/send", async (req, res) => {
  const { accountSid, authToken, from, to, body, contentSid, contentVariables } = req.body;
  try {
    const result = await sendWhatsApp({ accountSid, authToken, from, to, body, contentSid, contentVariables });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
});

export default router;
