import { Router } from "express";
import { getRatesAndTransitTimes, trackByNumber } from "../services/fedex.service.js";

const router = Router();

router.post("/rates", async (req, res, next) => {
  try {
    const data = await getRatesAndTransitTimes(req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/track", async (req, res, next) => {
  try {
    const { trackingNumber, carrierCode } = req.body;
    if (!trackingNumber) {
      return res.status(400).json({ message: "trackingNumber es requerido" });
    }
    const data = await trackByNumber(trackingNumber, carrierCode);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
