import { Router } from "express";
import { store } from "../data/store.js";
import { buildDashboardPayload } from "../services/dashboard.service.js";
import { updateRequestStatus } from "../services/request.service.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ orders: store.requests });
});

router.patch("/:orderId/status", (req, res) => {
  try {
    const request = updateRequestStatus(req.params.orderId, req.body.status, req.body.incidentDescription);
    res.json({ request, ...buildDashboardPayload() });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

export default router;
