import { Request, Response } from "express";
import { ApiResponse } from "../types/api.types";
import {
  CartResponse,
  AddToCartType,
  UpdateCartItemType,
  addToCartSchema,
  updateCartItemSchema,
} from "../types/cart.types";
import Cart from "../models/cartSchema";
import Product from "../models/productSchema";
import { formatZodError } from "../utils/errorUtils";

// cart response
const formatCartResponse = async (cart: any): Promise<CartResponse> => {
  await cart.populate({
    path: "items.product",
    select: "name imageUrl price stock",
  });

  return {
    _id: cart._id,
    items: cart.items.map((item: any) => ({
      product: {
        _id: item.product._id,
        name: item.product.name,
        imageUrl: item.product.imageUrl,
        price: item.product.price,
        stock: item.product.stock,
      },
      quantity: item.quantity,
      price: item.price,
    })),
    totalAmount: cart.totalAmount,
    totalItems: cart.items.length,
  };
};

export const getCart = async (
  req: Request,
  res: Response<ApiResponse<CartResponse>>
): Promise<void> => {
  try {
    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      cart = await Cart.create({
        user: req.user._id,
        items: [],
        totalAmount: 0,
      });
    }

    const formattedCart = await formatCartResponse(cart);

    res.status(200).json({
      success: true,
      data: formattedCart,
      message: "Cart retrieved successfully",
    });
  } catch (error) {
    console.error("Error in getCart:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve cart",
    });
  }
};

export const addToCart = async (
  req: Request<{}, {}, AddToCartType>,
  res: Response<ApiResponse<CartResponse>>
): Promise<void> => {
  try {
    const validationResult = addToCartSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: formatZodError(validationResult.error),
      });
      return;
    }

    const { productId, quantity } = validationResult.data;

    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
      return;
    }

    if (product.stock < quantity) {
      res.status(400).json({
        success: false,
        message: "Insufficient stock",
      });
      return;
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = await Cart.create({
        user: req.user._id,
        items: [],
      });
    }

    const existingItemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    );

    if (existingItemIndex > -1) {
      cart.items[existingItemIndex].quantity += quantity;
      cart.items[existingItemIndex].price = product.price;
    } else {
      cart.items.push({
        product: productId,
        quantity,
        price: product.price,
      });
    }

    await cart.save();
    const formattedCart = await formatCartResponse(cart);

    res.status(200).json({
      success: true,
      data: formattedCart,
      message: "Product added to cart successfully",
    });
  } catch (error) {
    console.error("Error in addToCart:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add product to cart",
    });
  }
};

export const updateCartItem = async (
  req: Request<{ productId: string }, {}, UpdateCartItemType>,
  res: Response<ApiResponse<CartResponse>>
): Promise<void> => {
  try {
    const validationResult = updateCartItemSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: formatZodError(validationResult.error),
      });
      return;
    }

    const { quantity } = validationResult.data;
    const { productId } = req.params;

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      res.status(404).json({
        success: false,
        message: "Cart not found",
      });
      return;
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    );

    if (itemIndex === -1) {
      res.status(404).json({
        success: false,
        message: "Product not found in cart",
      });
      return;
    }

    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
      return;
    }

    if (product.stock < quantity) {
      res.status(400).json({
        success: false,
        message: "Insufficient stock",
      });
      return;
    }

    cart.items[itemIndex].quantity = quantity;
    cart.items[itemIndex].price = product.price;

    await cart.save();
    const formattedCart = await formatCartResponse(cart);

    res.status(200).json({
      success: true,
      data: formattedCart,
      message: "Cart updated successfully",
    });
  } catch (error) {
    console.error("Error in updateCartItem:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update cart",
    });
  }
};

export const removeFromCart = async (
  req: Request<{ productId: string }>,
  res: Response<ApiResponse<CartResponse>>
): Promise<void> => {
  try {
    const { productId } = req.params;

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      res.status(404).json({
        success: false,
        message: "Cart not found",
      });
      return;
    }

    cart.items = cart.items.filter(
      (item) => item.product.toString() !== productId
    );

    await cart.save();
    const formattedCart = await formatCartResponse(cart);

    res.status(200).json({
      success: true,
      data: formattedCart,
      message: "Product removed from cart successfully",
    });
  } catch (error) {
    console.error("Error in removeFromCart:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove product from cart",
    });
  }
};

export const clearCart = async (
  req: Request,
  res: Response<ApiResponse<null>>
): Promise<void> => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      res.status(404).json({
        success: false,
        message: "Cart not found",
      });
      return;
    }

    cart.items = [];
    await cart.save();

    res.status(200).json({
      success: true,
      data: null,
      message: "Cart cleared successfully",
    });
  } catch (error) {
    console.error("Error in clearCart:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear cart",
    });
  }
};
