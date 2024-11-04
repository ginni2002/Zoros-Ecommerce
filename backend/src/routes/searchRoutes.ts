import express, { Router } from "express";
import { searchProducts } from "../controllers/searchController";

const router: Router = express.Router();

router.get("/", searchProducts);

export default router;
