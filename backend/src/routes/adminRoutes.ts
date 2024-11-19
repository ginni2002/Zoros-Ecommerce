import express, { Router } from "express";
import {
  addMockData,
  clearRateLimits,
  checkRateLimits,
} from "../controllers/adminController";
import {
  registerAdmin,
  login,
  verifyOTPAndLogin,
} from "../controllers/adminAuthController";
import {
  authenticateAdmin,
  requireSuperAdmin,
} from "../middleware/adminAuthMiddleware";
// import { validateFileUpload } from "../middleware/requestValidator";
// import { ALLOWED_IMAGE_TYPES, FILE_SIZE_LIMITS } from "../types/file.types";

const router: Router = express.Router();

router.post("/mock/add_Data", addMockData);

router.post("/clear-rate-limits", clearRateLimits);
router.get("/check-limits", checkRateLimits);

// router.post(
//   "/mock-add_Data-with_Image",
//   validateFileUpload({
//     allowedTypes: ALLOWED_IMAGE_TYPES,
//     maxSize: FILE_SIZE_LIMITS.IMAGE,
//     required: true,
//     maxFiles: 5,
//   }),
//   addMockDataWithImage
// );

router.post("/register", registerAdmin);
router.post("/login", login);
router.post("/verify-otp", verifyOTPAndLogin);

router.get("/me", authenticateAdmin, async (req, res) => {
  res.status(200).json({
    success: true,
    data: req.admin,
    message: "Admin profile retrieved successfully",
  });
});

export default router;
