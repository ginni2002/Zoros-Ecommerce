import express, { Router } from "express";
import {
  getAllSellers,
  getPendingSellers,
  getSellerById,
  approveSeller,
  rejectSeller,
  getSellerStatistics,
} from "../controllers/adminSellerController";
import { authenticateAdmin } from "../middleware/adminAuthMiddleware";

const router: Router = express.Router();

router.use(authenticateAdmin);

router.get("/sellers", getAllSellers);
router.get("/sellers/pending", getPendingSellers);
router.get("/sellers/:id", getSellerById);
router.post("/sellers/approve", approveSeller);
router.post("/sellers/reject", rejectSeller);
router.get("/sellers/statistics/overview", getSellerStatistics);

export default router;
