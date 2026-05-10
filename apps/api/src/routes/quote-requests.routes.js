import { Router } from "express";
import { saveStore, store } from "../data/store.js";
import { buildDashboardPayload } from "../services/dashboard.service.js";
import { createQuoteRequest, quoteRequest } from "../services/request.service.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ requests: store.requests });
});

router.post("/", (req, res) => {
  const requiredFields = [
    "customerName",
    "contactPerson",
    "contactPhone",
    "contactEmail",
    "pickupAddress",
    "deliveryAddress",
    "destinationCity",
    "packages",
    "estimatedWeightKg",
    "cargoDescription",
    // requiredDate, requiredTime, distanceKm, estimatedPrice, avioneta are optional
  ];

  const missingFields = requiredFields.filter((field) => !req.body[field]);
  if (missingFields.length > 0) {
    return res.status(422).json({
      message: "Faltan campos obligatorios",
      errors: missingFields.map((field) => ({ field, message: `Falta ${field}` })),
    });
  }

  const request = createQuoteRequest(req.body);
  res.status(201).json({ request, ...buildDashboardPayload() });
});

// Mark WhatsApp reminder sent
router.patch("/:requestId/reminder", (req, res) => {
  const request = store.requests.find(r => r.id === req.params.requestId);
  if (!request) return res.status(404).json({ message: "No encontrado" });
  if (!request.remindersSent) request.remindersSent = [];
  request.remindersSent.push({ type: req.body.type, sentAt: new Date().toISOString() });
  request.whatsappSent = true;
  saveStore();
  res.json({ ok: true, request });
});

router.patch("/:requestId/quote", (req, res) => {
  try {
    const request = quoteRequest(req.params.requestId, req.body);
    res.json({ request, ...buildDashboardPayload() });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

export default router;
