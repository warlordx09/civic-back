
import { Router } from "express";
import jwt from "jsonwebtoken";
import prisma from "../db";
import dotenv from "dotenv";

dotenv.config();
const router = Router();


router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, role, authorityId } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "All fields are required" });

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser)
      return res.status(400).json({ error: "Email already registered" });


    const result = await prisma.user.create({
      data: {
        name,
        email,
        password,
        role: role || "user",
        authorityId: authorityId || null
      },
      select: { id: true, name: true, email: true, role: true, authorityId: true },
    });

    res.status(201).json({ message: "Signup successful", user: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(email,password)
    const all = await prisma.user.findMany()
    console.log("all",all)
    const user = await prisma.user.findUnique({ where: { email } });
    console.log("the user",user)
    if (!user) return res.status(400).json({ error: "Invalid email or password" });


    if (password !== user.password)
      return res.status(400).json({ error: "Invalid email or password" });

    const payload: any = {
      id: user.id,
      role: user.role,
      email: user.email,
    };
    if (user.authorityId) payload.authorityId = user.authorityId;

    const token = jwt.sign(payload, process.env.JWT_SECRET || "supersecretkey", { expiresIn: "1d" });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        authorityId: user.authorityId ?? null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
