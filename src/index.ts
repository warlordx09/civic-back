import express from "express";
import dotenv from "dotenv";
import authRoutes from "./routes/auth";
import issueRoutes from "./routes/issues";
import cors from "cors"
import prisma from "./db";
dotenv.config();

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE","PATCH"],
    credentials: true,
  })
);

console.log("bunty")

app.use("/api/auth", authRoutes);
app.use("/api/issues", issueRoutes);

app.get("/authorities", async (req, res) => {
  console.log('oh yeah')
  try {
    const authorities = await prisma.authority.findMany({
      select: {
        id: true,
        name: true,
        level: true,
        parentId: true,
      },
      orderBy: { level: "asc" },
    });

    res.json(authorities);
  } catch (err) {
    console.error("Error fetching authorities:", err);
    res.status(500).json({ error: "Server error" });
  }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on oh port ${PORT}`));
