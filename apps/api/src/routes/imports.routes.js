import { Router } from "express";
import { buildDashboardPayload } from "../services/dashboard.service.js";
import { importOrders, validateImportRows } from "../services/request.service.js";

const router = Router();

router.post("/validate", (req, res) => {
  const rows = req.body.rows || [];
  res.json({ errors: validateImportRows(rows) });
});

router.post("/orders", async (req, res) => {
  try {
    const rows = req.body.rows || [];
    const result = await importOrders(rows);

    if (result.errors.length > 0) {
      return res.status(422).json(result);
    }

    return res.status(201).json({ ...result, ...(await buildDashboardPayload()) });
  } catch (err) {
    console.error("[imports/orders] error:", err);
    return res.status(500).json({ message: err.message || "Error al importar" });
  }
});

export default router;
