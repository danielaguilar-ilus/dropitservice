import { Router } from "express";
import authRoutes from "./auth.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import importsRoutes from "./imports.routes.js";
import mailRoutes from "./mail.routes.js";
import whatsappRoutes from "./whatsapp.routes.js";
import ordersRoutes from "./orders.routes.js";
import planningRoutes from "./planning.routes.js";
import quoteRequestsRoutes from "./quote-requests.routes.js";
import quotesRoutes from "./quotes.routes.js";
import trackingRoutes from "./tracking.routes.js";
import trucksRoutes from "./trucks.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/quote-requests", quoteRequestsRoutes);
router.use("/quotes", quotesRoutes);
router.use("/orders", ordersRoutes);
router.use("/imports", importsRoutes);
router.use("/planning", planningRoutes);
router.use("/trucks", trucksRoutes);
router.use("/tracking", trackingRoutes);
router.use("/mail", mailRoutes);
router.use("/whatsapp", whatsappRoutes);

export default router;
