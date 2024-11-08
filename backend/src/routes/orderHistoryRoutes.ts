import express, { Router } from "express";
import {
  getOrderHistory,
  getOrderDetails,
} from "../controllers/orderHistoryController";
import { authenticateUser } from "../middleware/authMiddleware";

const router: Router = express.Router();

router.use(authenticateUser);

router.get("/", getOrderHistory);
router.get("/:orderId", getOrderDetails);

export default router;
