// Package Imports
import express, { Express, Request, Response, NextFunction } from "express";
import { createServer, Server } from "http";
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

class AppServer {
  private app: Express;
  private server: Server | null;
  private port: number;

  constructor() {
    // Express app
    this.app = express();
    this.server = null;

    // environment variables
    this.loadEnvVariables();

    this.port = parseInt(process.env.PORT || "8000", 10);
  }

  private loadEnvVariables(): void {
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

    const missingEnvVars = requiredEnvVars.filter(
      (envVar) => !process.env[envVar]
    );
    if (missingEnvVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingEnvVars.join(", ")}`
      );
    }
  }

  private initializeRoutes(): void {
    // API Routes
    this.app.use("/api/admin", adminRoutes);
    this.app.use("/api/auth", authRoutes);
    this.app.use("/api/profile", profileRoutes);
    this.app.use("/api/products", productRoutes);
    this.app.use("/api/search", searchRoutes);
    this.app.use("/api/cart", cartRoutes);
    this.app.use("/api/orders", orderRoutes);
    this.app.use("/api/order-history", orderHistoryRoutes);

    // Health Check
    this.app.get("/health", (_req: Request, res: Response) => {
      res.status(200).json({
        status: "Ok",
        timestamp: new Date(),
        uptime: process.uptime(),
      });
    });

    // 404 Handler
    this.app.use((_req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        message: "Route not found",
      });
    });

    // Error Handler
    this.app.use(errorHandler);
  }

  private async initializeServices(): Promise<void> {
    try {
      // Connect to MongoDB
      await connectDB();

      // Connect to Redis
      const redisConnected = await redisClient.ensureConnection();
      if (!redisConnected) {
        console.warn(
          "Failed to connect to Redis - rate limiting will use memory store"
        );
      }

      // Initialize cleanup service
      cleanupService.initialize();
    } catch (error) {
      console.error("Failed to initialize services:", error);
      throw error;
    }
  }

  private initializeSecurityMiddleware(): void {
    this.app.use(helmet());
    this.app.use(
      cors({
        origin: process.env.FRONTEND_URL || "https://localhost:3000",
        credentials: true,
      })
    );
    this.app.use(securityHeaders);
  }

  private initializeRequestHandlingMiddleware(): void {
    // Webhooks route
    this.app.use("/api/webhooks/stripe", webhookRoutes);

    // Body parsing middleware
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.json({ limit: "50mb" }));

    // File upload middleware
    this.app.use(
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

    // Input sanitization
    this.app.use(sanitizeInput);
  }

  private initializeRateLimiting(): void {
    if (redisClient.isConnected()) {
      console.log("Initializing rate limiters with Redis store");
    } else {
      console.warn("Initializing rate limiters with memory store");
    }

    this.app.use(apiLimiter);
    this.app.use("/api/auth", authLimiter);
    this.app.use("/api/search", searchLimiter);
    this.app.use("/api/orders", orderLimiter);
  }

  public async initialize(): Promise<void> {
    try {
      // Initialize all middleware and services

      await this.initializeServices();
      this.initializeSecurityMiddleware();
      this.initializeRequestHandlingMiddleware();
      this.initializeRateLimiting();
      this.initializeRoutes();

      // Create and start HTTP server
      this.server = createServer(this.app);

      this.server.listen(this.port, () => {
        console.log(`Server is running on port: ${this.port}`);
        console.log(
          `Health check available at http://localhost:${this.port}/health`
        );
      });

      const gracefulShutdown = async () => {
        if (this.server) {
          this.server.close(() => {
            console.log("HTTP server closed");
            process.exit(0);
          });
        }
      };

      process.on("SIGTERM", gracefulShutdown);
      process.on("SIGINT", gracefulShutdown);

      // Handle server errors
      this.server.on("error", (error) => {
        console.error("Server error:", error);
        process.exit(1);
      });
    } catch (error) {
      console.error("Failed to initialize application:", error);
      process.exit(1);
    }
  }

  public getApp(): Express {
    return this.app;
  }

  public getServer(): Server | null {
    return this.server;
  }

  public async shutdown(): Promise<void> {
    if (this.server) {
      this.server.close(() => {
        console.log("Server shut down gracefully");
        process.exit(0);
      });
    }
  }
}

// Create and initialize server
const appServer = new AppServer();

// Initialize the server
appServer.initialize().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

export default appServer.getApp();
