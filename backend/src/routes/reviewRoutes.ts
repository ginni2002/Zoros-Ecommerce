import express, { Router } from "express";
import {
  createReview,
  getProductReviews,
  markReviewHelpful,
  deleteReview,
} from "../controllers/reviewController";
import { authenticateUser } from "../middleware/authMiddleware";

const router: Router = express.Router();

// Public routes
router.get("/product/:productId", getProductReviews);

// Protected routes
router.use(authenticateUser);
router.post("/", createReview as express.RequestHandler);
router.post("/:reviewId/helpful", markReviewHelpful as express.RequestHandler);
router.delete("/:reviewId", deleteReview as express.RequestHandler);

export default router;
