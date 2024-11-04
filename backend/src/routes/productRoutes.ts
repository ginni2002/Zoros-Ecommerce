import express, { Router } from "express";
import {
  getProducts,
  getProductById,
  getProductsByCategory,
} from "../controllers/productController";

const router: Router = express.Router();

// Public routes
router.get("/", getProducts);
router.get("/category/:category", getProductsByCategory);
router.get("/:id", getProductById);

export default router;
