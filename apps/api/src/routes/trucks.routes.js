import { Router } from "express";
import { saveStore, store } from "../data/store.js";
import { createId } from "../lib/id.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ trucks: store.trucks });
});

router.post("/", (req, res) => {
  const truck = {
    id: createId("trk"),
    name: req.body.name,
    plate: req.body.plate,
    maxWeightKg: Number(req.body.maxWeightKg || 0),
    maxPackages: Number(req.body.maxPackages || 0),
    driverName: req.body.driverName,
    driverPhone: req.body.driverPhone,
    status: req.body.status || "Disponible",
  };

  store.trucks.push(truck);
  saveStore();
  res.status(201).json({ truck, trucks: store.trucks });
});

export default router;
