// Package Imports
import express, { Express, Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";

// File Imports
import connectDB from "./database/connectDB";
import adminRoutes from "./routes/adminRoutes";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/authRoutes";
import productRoutes from "./routes/productRoutes";
import searchRoutes from "./routes/searchRoutes";
import cartRoutes from "./routes/cartRoutes";
import orderRoutes from "./routes/orderRoutes";
import webhookRoutes from "./routes/webhookRoutes";

// Initialise Environment Variable
dotenv.config();

const requiredEnvVars = [
  "PORT",
  "MONGO_URI",
  "JWT_SECRET",
  "JWT_EXPIRE",
  "STRIPE_SECRET_KEY",
  "STRIPE_PUBLIC_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "FRONTEND_URL",
];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
}

// Create App
const app: Express = express();

// Initialise PORT
const PORT: number = parseInt(process.env.PORT, 10);

// Connect Database
connectDB();

// Webhooks
app.use("/api/webhooks", webhookRoutes);

//Middlewares
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "https://localhost:3000",
    credentials: true,
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "50mb" }));

//Routes
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);

// Backend Health Check
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "Ok",
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});

// Unmatched Routes handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error Handling Middleware
app.use(errorHandler);

// Start Server
const startServer = async () => {
  try {
    app.listen(PORT, () => {
      console.log(`Server is running on port: ${PORT}`);
      console.log(`Health check available at http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error("Failed to start server: ", error);
    process.exit(1);
  }
};
startServer();

export default app;
