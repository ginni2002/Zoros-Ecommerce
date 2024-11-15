import { Request, Response, RequestHandler } from "express";
import { Types } from "mongoose";
import { ApiResponse } from "../types/api.types";
import {
  CreateReviewType,
  ProductReviewsResponse,
  ReviewResponse,
  RatingDistribution,
  PopulatedReview,
} from "../types/review.types";
import { IUser, UserRole } from "../types/user.types";
import Review from "../models/reviewSchema";
import Order from "../models/orderSchema";
import { reviewSchema } from "../types/review.types";
import { formatZodError } from "../utils/errorUtils";

interface AuthRequest<P = {}, B = {}, Q = {}> extends Request<P, any, B, Q> {
  user: IUser;
  token?: string;
}

type HelpfulRequest = RequestHandler<
  { reviewId: string },
  ApiResponse<{ helpfulVotes: number }>,
  {},
  {}
>;

type DeleteRequest = RequestHandler<
  { reviewId: string },
  ApiResponse<null>,
  {},
  {}
>;

type PopulatedUser = Pick<IUser, "_id" | "name">;

class ReviewError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "ReviewError";
  }
}

const formatReviewResponse = (review: PopulatedReview): ReviewResponse => ({
  _id: review._id.toString(),
  user: {
    _id: review.user._id.toString(),
    name: review.user.name,
  },
  rating: review.rating,
  comment: review.comment,
  verifiedPurchase: review.verifiedPurchase,
  helpfulVotes: review.helpfulVotes,
  createdAt: review.createdAt,
});

const createDistribution = (ratings: number[]): RatingDistribution => {
  const distribution: RatingDistribution = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  ratings.forEach((rating) => {
    if (rating >= 1 && rating <= 5) {
      distribution[rating as keyof RatingDistribution]++;
    }
  });

  return distribution;
};

export const createReview: RequestHandler<
  {},
  ApiResponse<ReviewResponse>,
  CreateReviewType
> = async (req, res): Promise<void> => {
  try {
    const validationResult = reviewSchema.safeParse(req.body);

    if (!validationResult.success) {
      // This will be caught by your ZodError handler
      throw validationResult.error;
    }

    const { productId, rating, comment } = validationResult.data;
    const userId = new Types.ObjectId(req.user._id);
    const productObjectId = new Types.ObjectId(productId);

    const existingReview = await Review.findOne({
      user: userId,
      product: productObjectId,
    });

    if (existingReview) {
      throw new ReviewError(400, "You have already reviewed this product");
    }

    const [hasOrdered, review] = await Promise.all([
      Order.findOne({
        user: userId,
        "items.product": productObjectId,
        orderStatus: "DELIVERED",
      }),
      Review.create({
        user: userId,
        product: productObjectId,
        rating,
        comment,
        verifiedPurchase: false,
      }),
    ]);

    review.verifiedPurchase = !!hasOrdered;
    await review.save();

    const populatedReview = await review.populate<{ user: PopulatedUser }>(
      "user",
      "name"
    );

    res.status(201).json({
      success: true,
      data: formatReviewResponse(populatedReview),
      message: "Review added successfully",
    });
  } catch (error) {
    console.error("Error in createReview:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create review",
    });
  }
};

export const getProductReviews: RequestHandler<
  { productId: string },
  ApiResponse<ProductReviewsResponse>,
  {},
  { page?: string; limit?: string }
> = async (req, res): Promise<void> => {
  try {
    const { productId } = req.params;
    const page = Math.max(parseInt(req.query.page || "1"), 1);
    const limit = Math.min(parseInt(req.query.limit || "10"), 50); // Cap at 50
    const skip = (page - 1) * limit;

    const productObjectId = new Types.ObjectId(productId);

    const [reviews, stats] = await Promise.all([
      Review.find({ product: productObjectId })
        .populate<{ user: PopulatedUser }>("user", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      Review.aggregate([
        { $match: { product: productObjectId } },
        {
          $group: {
            _id: null,
            averageRating: { $avg: "$rating" },
            totalReviews: { $sum: 1 },
            verifiedPurchases: {
              $sum: { $cond: ["$verifiedPurchase", 1, 0] },
            },
            ratingDistribution: {
              $push: "$rating",
            },
          },
        },
      ]),
    ]);

    const distribution = createDistribution(stats[0]?.ratingDistribution || []);

    const totalReviews = stats[0]?.totalReviews || 0;
    const totalPages = Math.ceil(totalReviews / limit);

    res.status(200).json({
      success: true,
      data: {
        reviews: reviews.map(formatReviewResponse),
        summary: {
          averageRating: Math.round((stats[0]?.averageRating || 0) * 10) / 10,
          totalReviews,
          ratingDistribution: distribution,
          verifiedPurchases: stats[0]?.verifiedPurchases || 0,
        },
        pagination: {
          currentPage: page,
          totalPages,
          totalReviews,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      message: "Reviews retrieved successfully",
    });
  } catch (error) {
    console.error("Error in getProductReviews:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve reviews",
    });
  }
};

export const markReviewHelpful: HelpfulRequest = async (
  req,
  res
): Promise<void> => {
  try {
    const reviewId = new Types.ObjectId(req.params.reviewId);
    const userId = new Types.ObjectId(req.user._id);

    const review = await Review.findOneAndUpdate(
      {
        _id: reviewId,
        user: { $ne: userId }, // Prevent self-voting
      },
      { $inc: { helpfulVotes: 1 } },
      { new: true }
    );

    if (!review) {
      res.status(404).json({
        success: false,
        message: "Review not found or you cannot vote on your own review",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        helpfulVotes: review.helpfulVotes,
      },
      message: "Review marked as helpful",
    });
  } catch (error) {
    console.error("Error in markReviewHelpful:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark review as helpful",
    });
  }
};

export const deleteReview: DeleteRequest = async (req, res): Promise<void> => {
  try {
    const reviewId = new Types.ObjectId(req.params.reviewId);
    const userId = new Types.ObjectId(req.user._id);

    const review = await Review.findOneAndDelete({
      _id: reviewId,
      $or: [
        { user: userId },
        { $and: [{ role: UserRole.ADMIN }] }, // Admins can delete any review
      ],
    });

    if (!review) {
      res.status(404).json({
        success: false,
        message: "Review not found or unauthorized",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: null,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteReview:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete review",
    });
  }
};
