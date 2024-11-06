import express, { Router } from "express";
import {
  createOrder,
  getOrderById,
  getUserOrders,
  handlePaymentSuccess,
} from "../controllers/orderController";
import { authenticateUser } from "../middleware/authMiddleware";

const router: Router = express.Router();

router.use(authenticateUser);

router.post("/", createOrder);
router.get("/", getUserOrders);
router.get("/:orderId", getOrderById);
router.post("/payment-success", handlePaymentSuccess);

export default router;
