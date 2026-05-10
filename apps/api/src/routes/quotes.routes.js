import { Router } from "express";
import { estimateRoute } from "../services/map.service.js";
import { buildAutomaticQuote, buildManualQuote } from "../services/pricing.service.js";

const router = Router();

router.post("/preview", async (req, res) => {
  const payload = req.body;

  if (payload.mode === "automatic") {
    const route = await estimateRoute(payload.origin, payload.destination);
    const quote = buildAutomaticQuote(payload, route);
    return res.json({ quote });
  }

  if (payload.mode === "manual") {
    const route = await estimateRoute("Nunoa, Santiago de Chile", payload.destination);
    const quote = buildManualQuote(payload, route);
    return res.json({ quote });
  }

  return res.status(400).json({
    message: "Modo de cotizacion no soportado",
  });
});

export default router;
