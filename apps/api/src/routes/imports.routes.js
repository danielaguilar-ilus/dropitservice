import { Router } from "express";
import { buildDashboardPayload } from "../services/dashboard.service.js";
import { importOrders, validateImportRows } from "../services/request.service.js";

const router = Router();

router.post("/validate", (req, res) => {
  const rows = req.body.rows || [];
  res.json({ errors: validateImportRows(rows) });
});

router.post("/orders", (req, res) => {
  const rows = req.body.rows || [];
  const result = importOrders(rows);

  if (result.errors.length > 0) {
    return res.status(422).json(result);
  }

  return res.status(201).json({ ...result, ...buildDashboardPayload() });
});

export default router;
