import express, { Router } from "express";
import { signup, login, getCurrentUser } from "../controllers/authController";
// import { authenticateUser } from "../middleware/authMiddleware";

const router: Router = express.Router();

// Public routes
router.post("/signup", signup);
router.post("/login", login);

// Protected routes
// router.get("/me", authenticateUser, getCurrentUser);

export default router;
