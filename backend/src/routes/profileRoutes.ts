import express, { Router } from "express";
import {
  getProfile,
  updateProfile,
  changePassword,
  updateAddress,
  deleteAddress,
} from "../controllers/profileController";
import { authenticateUser } from "../middleware/authMiddleware";

const router: Router = express.Router();

router.use(authenticateUser);

router.get("/", getProfile);
router.put("/", updateProfile);
router.put("/change-password", changePassword);

router.post("/address", updateAddress);
router.put("/address/:addressId", updateAddress);
router.delete("/address/:addressId", deleteAddress);

export default router;
