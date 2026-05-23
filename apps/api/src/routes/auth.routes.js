import { Router } from "express";
import { store } from "../data/store.js";
import * as db from "../data/db.js";

const router = Router();
const HAS_DB = !!process.env.DATABASE_URL;

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Faltan email o password" });
  }

  try {
    if (HAS_DB) {
      const user = await db.verifyPassword(email, password);
      if (!user || user.isActive === false) {
        return res.status(401).json({ message: "Credenciales invalidas" });
      }
      return res.json({
        token: "demo-token-dropit",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    }

    // Legacy fallback — store.users con password en texto plano
    const user = store.users.find(
      (item) => item.email.toLowerCase() === String(email).toLowerCase() && item.password === password,
    );

    if (!user) {
      return res.status(401).json({ message: "Credenciales invalidas" });
    }

    return res.json({
      token: "demo-token-dropit",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("[auth/login] error:", err);
    return res.status(500).json({ message: "Error al iniciar sesion" });
  }
});

export default router;
