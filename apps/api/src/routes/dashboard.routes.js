import { Router } from "express";
import { buildDashboardPayload } from "../services/dashboard.service.js";

const router = Router();

router.get("/bootstrap", (_req, res) => {
  res.json(buildDashboardPayload());
});

export default router;
