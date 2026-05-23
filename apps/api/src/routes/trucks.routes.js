import { Router } from "express";
import { saveStore, store } from "../data/store.js";
import * as db from "../data/db.js";
import { createId } from "../lib/id.js";

const router = Router();
const HAS_DB = !!process.env.DATABASE_URL;

router.get("/", async (_req, res) => {
  try {
    const trucks = HAS_DB ? await db.listTrucks() : store.trucks;
    res.json({ trucks });
  } catch (err) {
    console.error("[trucks/list] error:", err);
    res.status(500).json({ message: "Error al listar camiones" });
  }
});

router.post("/", async (req, res) => {
  try {
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

    let saved;
    let trucks;
    if (HAS_DB) {
      saved  = await db.createTruck(truck);
      trucks = await db.listTrucks();
    } else {
      store.trucks.push(truck);
      saveStore();
      saved  = truck;
      trucks = store.trucks;
    }
    res.status(201).json({ truck: saved, trucks });
  } catch (err) {
    console.error("[trucks/create] error:", err);
    res.status(500).json({ message: err.message || "Error al crear camion" });
  }
});

export default router;
