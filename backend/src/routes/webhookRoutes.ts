import express, { Router } from "express";
import { handleStripeWebhook } from "../controllers/webhookController";

const router: Router = express.Router();

router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

export default router;
