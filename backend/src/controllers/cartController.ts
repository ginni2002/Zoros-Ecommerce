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
import redisClient from "../utils/redisUtils";

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
    const userId = req.user._id.toString();

    const cachedCart = await redisClient.getCachedCart(userId);
    if (cachedCart) {
      res.status(200).json({
        success: true,
        data: cachedCart,
        message: "Cart retrieved from cache successfully",
      });
      return;
    }

    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      cart = await Cart.create({
        user: req.user._id,
        items: [],
        totalAmount: 0,
      });
    }

    const formattedCart = await formatCartResponse(cart);

    await redisClient.cacheCart(userId, formattedCart);

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
    const userId = req.user._id.toString();

    let product = await redisClient.getCachedProduct(productId);
    if (!product) {
      product = await Product.findById(productId);
      if (!product) {
        res.status(404).json({
          success: false,
          message: "Product not found",
        });
        return;
      }
      await redisClient.cacheProduct(product);
    }

    if (product.stock < quantity) {
      res.status(400).json({
        success: false,
        message: "Insufficient stock",
      });
      return;
    }

    let cart = await redisClient.getCachedCart(userId);
    let cartDocument;

    if (!cart) {
      cartDocument = await Cart.findOne({ user: userId });
      if (!cartDocument) {
        cartDocument = await Cart.create({
          user: userId,
          items: [],
        });
      }
    } else {
      cartDocument = await Cart.findOne({ user: userId });
      if (!cartDocument) {
        await redisClient.invalidateCart(userId);
        cartDocument = await Cart.create({
          user: userId,
          items: [],
        });
      }
    }

    const existingItemIndex = cartDocument.items.findIndex(
      (item) => item.product.toString() === productId
    );

    if (existingItemIndex > -1) {
      cartDocument.items[existingItemIndex].quantity += quantity;
      cartDocument.items[existingItemIndex].price = product.price;
    } else {
      cartDocument.items.push({
        product: productId,
        quantity,
        price: product.price,
      });
    }

    await cartDocument.save();

    const formattedCart = await formatCartResponse(cartDocument);
    await redisClient.updateCartCache(userId, formattedCart);

    res.status(200).json({
      success: true,
      data: formattedCart,
      message: "Product added to cart successfully",
    });
  } catch (error) {
    console.error("Error in addToCart:", error);
    if (req.user?._id) {
      await redisClient.invalidateCart(req.user._id.toString());
    }
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
    const userId = req.user._id.toString();

    let product = await redisClient.getCachedProduct(productId);
    if (!product) {
      product = await Product.findById(productId);
      if (!product) {
        res.status(404).json({
          success: false,
          message: "Product not found",
        });
        return;
      }

      await redisClient.cacheProduct(product);
    }

    if (product.stock < quantity) {
      res.status(400).json({
        success: false,
        message: "Insufficient stock",
      });
      return;
    }

    let cartDocument = null;
    const cachedCart = await redisClient.getCachedCart(userId);

    if (cachedCart) {
      cartDocument = await Cart.findOne({ user: userId });
      if (!cartDocument) {
        await redisClient.invalidateCart(userId);
        res.status(404).json({
          success: false,
          message: "Cart not found",
        });
        return;
      }
    } else {
      cartDocument = await Cart.findOne({ user: userId });
      if (!cartDocument) {
        res.status(404).json({
          success: false,
          message: "Cart not found",
        });
        return;
      }
    }

    const itemIndex = cartDocument.items.findIndex(
      (item) => item.product.toString() === productId
    );

    if (itemIndex === -1) {
      res.status(404).json({
        success: false,
        message: "Product not found in cart",
      });
      return;
    }

    cartDocument.items[itemIndex].quantity = quantity;
    cartDocument.items[itemIndex].price = product.price;
    await cartDocument.save();

    const formattedCart = await formatCartResponse(cartDocument);

    await redisClient.updateCartCache(userId, formattedCart);

    res.status(200).json({
      success: true,
      data: formattedCart,
      message: "Cart updated successfully",
    });
  } catch (error) {
    console.error("Error in updateCartItem:", error);

    if (req.user?._id) {
      await redisClient.invalidateCart(req.user._id.toString());
    }
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
    const userId = req.user._id.toString();

    let cartDocument = null;
    const cachedCart = await redisClient.getCachedCart(userId);

    if (cachedCart) {
      cartDocument = await Cart.findOne({ user: userId });
      if (!cartDocument) {
        await redisClient.invalidateCart(userId);
        res.status(404).json({
          success: false,
          message: "Cart not found",
        });
        return;
      }
    } else {
      cartDocument = await Cart.findOne({ user: userId });
      if (!cartDocument) {
        res.status(404).json({
          success: false,
          message: "Cart not found",
        });
        return;
      }
    }

    cartDocument.items = cartDocument.items.filter(
      (item) => item.product.toString() !== productId
    );

    await cartDocument.save();
    const formattedCart = await formatCartResponse(cartDocument);

    await redisClient.updateCartCache(userId, formattedCart);

    await redisClient.invalidateProduct(productId);

    res.status(200).json({
      success: true,
      data: formattedCart,
      message: "Product removed from cart successfully",
    });
  } catch (error) {
    console.error("Error in removeFromCart:", error);

    if (req.user?._id) {
      await redisClient.invalidateCart(req.user._id.toString());
    }
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
    const userId = req.user._id.toString();

    let cartDocument = null;
    const cachedCart = await redisClient.getCachedCart(userId);

    if (cachedCart) {
      cartDocument = await Cart.findOne({ user: userId });
      if (!cartDocument) {
        await redisClient.invalidateCart(userId);
        res.status(404).json({
          success: false,
          message: "Cart not found",
        });
        return;
      }
    } else {
      cartDocument = await Cart.findOne({ user: userId });
      if (!cartDocument) {
        res.status(404).json({
          success: false,
          message: "Cart not found",
        });
        return;
      }
    }

    const productIds = cartDocument.items.map((item) =>
      item.product.toString()
    );

    cartDocument.items = [];
    await cartDocument.save();

    await redisClient.invalidateCart(userId);

    await Promise.all(
      productIds.map((productId) => redisClient.invalidateProduct(productId))
    );

    res.status(200).json({
      success: true,
      data: null,
      message: "Cart cleared successfully",
    });
  } catch (error) {
    console.error("Error in clearCart:", error);

    if (req.user?._id) {
      await redisClient.invalidateCart(req.user._id.toString());
    }
    res.status(500).json({
      success: false,
      message: "Failed to clear cart",
    });
  }
};
