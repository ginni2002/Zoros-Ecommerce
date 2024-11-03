// Package Imports
import express, { Express, Request, Response, NextFunction } from "express";
import dotenv from "dotenv";

// File Imports
import connectDB from "./database/connectDB";
import adminRoutes from "./routes/adminRoutes";

// Initialise Environment Variable
dotenv.config();
if (!process.env.PORT) {
  throw new Error("PORT variable is not defined in Environment");
}

// Create App
const app: Express = express();

// Initialise PORT
const PORT: number = parseInt(process.env.PORT, 10);

// Connect Database
connectDB();

//Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "50mb" }));
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "App Middleware Error!" });
});

//Routes
app.use("/api/admin", adminRoutes);
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "Ok" });
});

// Start Server
const startServer = async () => {
  try {
    app.listen(PORT, () => {
      console.log(`Server is running on port: ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server: ", error);
    process.exit(1);
  }
};
startServer();

export default app;
