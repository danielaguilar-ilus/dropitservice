import { Router } from "express";
import { buildDashboardPayload } from "../services/dashboard.service.js";

const router = Router();

router.get("/bootstrap", async (_req, res) => {
  try {
    res.json(await buildDashboardPayload());
  } catch (err) {
    console.error("[dashboard/bootstrap] error:", err);
    res.status(500).json({ message: "Error al cargar dashboard" });
  }
});

export default router;
