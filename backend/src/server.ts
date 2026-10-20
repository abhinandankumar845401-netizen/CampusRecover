import dns from "node:dns";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dns.setServers(["8.8.8.8"]);
import connectDB from "./config/db.js";
import itemRoutes from "./routes/itemRoutes.js";
import authRoutes from "./routes/authRoutes.js";
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "CampusRecover API is running",
  });
});

// API routes
app.use("/api/items", itemRoutes);
app.use("/api/auth", authRoutes);

// Start server after connecting to MongoDB
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`CampusRecover server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
      console.log(`Auth API: http://localhost:${PORT}/api/auth`);
      console.log(`Items API: http://localhost:${PORT}/api/items`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
