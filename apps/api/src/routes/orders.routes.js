import { Router } from "express";
import { store } from "../data/store.js";
import * as db from "../data/db.js";
import { buildDashboardPayload } from "../services/dashboard.service.js";
import { updateRequestStatus } from "../services/request.service.js";

const router = Router();
const HAS_DB = !!process.env.DATABASE_URL;

router.get("/", async (_req, res) => {
  try {
    const orders = HAS_DB ? await db.listRequests() : store.requests;
    res.json({ orders });
  } catch (err) {
    console.error("[orders/list] error:", err);
    res.status(500).json({ message: "Error al listar pedidos" });
  }
});

router.patch("/:orderId/status", async (req, res) => {
  try {
    const request = await updateRequestStatus(req.params.orderId, req.body.status, req.body.incidentDescription);
    res.json({ request, ...(await buildDashboardPayload()) });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

export default router;
