import { Router } from "express";
import { buildDashboardPayload } from "../services/dashboard.service.js";
import { createRoutePlan } from "../services/request.service.js";

const router = Router();

router.post("/routes", (req, res) => {
  try {
    const route = createRoutePlan(req.body);
    return res.status(201).json({ route, ...buildDashboardPayload() });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

export default router;
