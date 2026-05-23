import { Router } from "express";
import { incidentStatus, store, workflow } from "../data/store.js";
import * as db from "../data/db.js";

const router = Router();
const HAS_DB = !!process.env.DATABASE_URL;

router.get("/:trackingCode", async (req, res) => {
  const code = req.params.trackingCode;
  let tracking = null;

  try {
    if (HAS_DB) {
      tracking = await db.findRequestByTracking(code);
      if (!tracking) {
        // Permitimos también buscar por id (compat con flujo previo)
        tracking = await db.findRequest(code);
      }
    } else {
      tracking = store.requests.find((item) => item.trackingCode === code || item.id === code);
    }
  } catch (err) {
    console.error("[tracking] error:", err);
    return res.status(500).json({ message: "Error al buscar seguimiento" });
  }

  if (!tracking) {
    return res.status(404).json({
      message: "Codigo de seguimiento no encontrado",
    });
  }

  const visibleStatuses = tracking.hasIncident ? [...workflow, incidentStatus] : workflow;

  return res.json({
    tracking: {
      ...tracking,
      visibleStatuses,
    },
  });
});

export default router;
