// Package Imports
import express, { Express, Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import fileUpload from "express-fileupload";

// File Imports
import connectDB from "./database/connectDB";
import adminRoutes from "./routes/adminRoutes";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/authRoutes";
import productRoutes from "./routes/productRoutes";
import searchRoutes from "./routes/searchRoutes";
import cartRoutes from "./routes/cartRoutes";
import orderRoutes from "./routes/orderRoutes";
import profileRoutes from "./routes/profileRoutes";
import webhookRoutes from "./routes/webhookRoutes";
import orderHistoryRoutes from "./routes/orderHistoryRoutes";
import {
  apiLimiter,
  authLimiter,
  searchLimiter,
  orderLimiter,
} from "./middleware/rateLimiter";
import { sanitizeInput } from "./middleware/requestValidator";
import cleanupService from "./utils/cleanupUtil";
import { securityHeaders } from "./middleware/securityHeaders";
import redisClient from "./utils/redisUtils";
import sellerAuthRoutes from "./routes/sellerAuthRoutes";
import reviewRoutes from "./routes/reviewRoutes";
import adminSellerRoutes from "./routes/adminSellerRoutes";
// import { testRedisConnection } from "./utils/redisUtils";
// import { testEmail } from "./utils/emailService";

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
  "EMAIL_USER",
  "EMAIL_APP_PASSWORD",
  "REDIS_HOST",
  "REDIS_PASSWORD",
  "REDIS_PORT",
];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
}

// Initialise PORT
const PORT: number = parseInt(process.env.PORT, 10);

// Create App
const app: Express = express();

// Security Middleware
const initializeSecurity = () => {
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || "https://localhost:3000",
      credentials: true,
    })
  );
  app.use(securityHeaders);
};

// Request Handling Middleware
const initializeRequestHandling = () => {
  // Stripe Webhook
  app.use("/api/webhooks/stripe", webhookRoutes);

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json({ limit: "50mb" }));

  app.use(
    fileUpload({
      limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max file size
      useTempFiles: true,
      tempFileDir: path.join(__dirname, "tmp"),
      createParentPath: true,
      parseNested: true,
      debug: process.env.NODE_ENV !== "production",
      abortOnLimit: true,
    })
  );

  app.use(sanitizeInput);
};

// Rate limiting
const initializeRateLimiting = () => {
  app.use(apiLimiter);
  app.use("/api/auth", authLimiter);
  app.use("/api/search", searchLimiter);
  app.use("/api/orders", orderLimiter);
};

const initializeRoutes = () => {
  //Routes
  app.use("/api/admin", adminRoutes);
  app.use("/api/admin", adminSellerRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/profile", profileRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/search", searchRoutes);
  app.use("/api/cart", cartRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/order-history", orderHistoryRoutes);
  app.use("/api/reviews", reviewRoutes);
  app.use("/api/sellerAuth", sellerAuthRoutes);

  // Backend Health Check
  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "Ok",
      timestamp: new Date(),
      uptime: process.uptime(),
    });
  });

  // 404 Handler Unmatched routes
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: "Route not found",
    });
  });

  // Error Handler
  app.use(errorHandler);
};

const initializeServices = async () => {
  try {
    // connect Database
    await connectDB();

    // Test redis connection
    // testRedisConnection();

    // Redis connection
    const redisConnected = await redisClient.ensureConnection();
    if (!redisConnected) {
      console.warn(
        "Redis connection failed - rate limiting will use memory store"
      );
    }

    //Email test
    // testEmail();

    // Temp File Cleanup
    cleanupService.initialize();
  } catch (error) {
    console.error("Failed to initialize services: ", error);
    throw error;
  }
};

const handleGracefulShutdown = (server: any) => {
  const shutdown = () => {
    console.log("Received shutdown signal");
    server.close(() => {
      console.log("Server shut down gracefully");
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
};

// Start Server
const startServer = async () => {
  try {
    await initializeServices();
    initializeSecurity();
    initializeRequestHandling();
    initializeRateLimiting();
    initializeRoutes();

    const server = app.listen(PORT, () => {
      console.log(`Server is running on port: ${PORT}`);
      console.log(`Health check available at http://localhost:${PORT}/health`);
    });

    handleGracefulShutdown(server);

    server.on("error", (error: Error) => {
      console.error("Server error:", error);
      process.exit(1);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

export default app;
