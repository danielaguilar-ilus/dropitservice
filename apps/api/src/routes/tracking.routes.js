import { Router } from "express";
import { incidentStatus, store, workflow } from "../data/store.js";

const router = Router();

router.get("/:trackingCode", (req, res) => {
  const tracking = store.requests.find((item) => item.trackingCode === req.params.trackingCode || item.id === req.params.trackingCode);

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
