import express, { Router } from "express";
import { addMockData } from "../controllers/adminController";

const router: Router = express.Router();

router.post("/mock/add_Data", addMockData);

export default router;
