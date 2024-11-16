// routes/sellerRoutes.ts
import express, { Router } from "express";
import {
  registerSeller,
  login,
  verifyEmail,
  getCurrentSeller,
  resendVerificationEmail,
} from "../controllers/sellerAuthController";
import {
  authenticateSeller,
  requireVerifiedSeller,
} from "../middleware/sellerAuthMiddleware";

const router: Router = express.Router();

router.post("/register", registerSeller);
router.post("/login", login);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerificationEmail);

router.get("/me", requireVerifiedSeller, getCurrentSeller);

export default router;
