import { Router } from "express";
import { buildDashboardPayload } from "../services/dashboard.service.js";
import { createRoutePlan } from "../services/request.service.js";

const router = Router();

router.post("/routes", async (req, res) => {
  try {
    const route = await createRoutePlan(req.body);
    return res.status(201).json({ route, ...(await buildDashboardPayload()) });
  } catch (error) {
    console.error("[planning/routes] error:", error);
    return res.status(400).json({ message: error.message });
  }
});

export default router;
