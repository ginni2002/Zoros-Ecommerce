import { Request, Response } from "express";
import Product, { IProduct } from "../models/productSchema";

//types
interface ProductData {
  name: string;
  description: string;
  price: number;
  category:
    | "GRAPHICS_CARD"
    | "GAMING_LAPTOP"
    | "MOUSE"
    | "KEYBOARD"
    | "MONITOR"
    | "HEADSET";
  brand: string;
  imageUrl: string;
}

interface SuccessResponse {
  success: true;
  data: IProduct;
}

interface ErrorResponse {
  success: false;
  message: string;
}

type ApiResponse = SuccessResponse | ErrorResponse;

export const addMockData = async (
  req: Request<{}, ApiResponse, ProductData>,
  res: Response<ApiResponse>
): Promise<void> => {
  try {
    const productData: ProductData = req.body;

    const requiredFields = [
      "name",
      "description",
      "price",
      "category",
      "brand",
      "imageUrl",
    ] as const;

    const missingFields = requiredFields.filter((field) => !productData[field]);
    if (missingFields.length > 0) {
      res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
      return;
    }

    const product = new Product(productData);
    await product.save();

    res.status(201).json({
      success: true,
      data: product,
    });
    return;
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server Error",
    });
    console.log("Error in addMockData");
  }
};
