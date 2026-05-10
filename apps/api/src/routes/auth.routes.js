import { Router } from "express";
import { store } from "../data/store.js";

const router = Router();

router.post("/login", (req, res) => {
  const { email, password } = req.body;

  const user = store.users.find(
    (item) => item.email.toLowerCase() === String(email).toLowerCase() && item.password === password
  );

  if (!user) {
    return res.status(401).json({
      message: "Credenciales invalidas",
    });
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
});

export default router;
