import { createApp } from "./app.js";
import { env } from "./config/env.js";

// Graceful error handling — prevent crashes from unhandled rejections
process.on("unhandledRejection", (reason) => {
  console.error("⚠️ Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("🔴 Uncaught Exception:", err);
  // Give time to flush logs, then exit
  setTimeout(() => process.exit(1), 1000);
});

const app = createApp();

app.listen(env.port, () => {
  console.log(`Dropit API running on http://localhost:${env.port}`);
});
