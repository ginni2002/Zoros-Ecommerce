import { z } from "zod";
import { Types, Document } from "mongoose";

export const reviewSchema = z.object({
  rating: z
    .number()
    .min(1, "Rating must be at least 1")
    .max(5, "Rating cannot exceed 5"),
  comment: z
    .string()
    .min(10, "Review must be at least 10 characters")
    .max(500, "Review cannot exceed 500 characters"),
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid product ID"),
});

export type RatingDistribution = {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
};

interface ReviewBase {
  rating: number;
  comment: string;
  verifiedPurchase: boolean;
  helpfulVotes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IReview extends ReviewBase {
  _id: Types.ObjectId;
  user: Types.ObjectId | string;
  product: Types.ObjectId | string;
}

export type CreateReviewType = z.infer<typeof reviewSchema>;

export type PopulatedUser = {
  _id: Types.ObjectId;
  name: string;
};

export type PopulatedReview = Omit<IReview, "user"> & {
  user: PopulatedUser;
};

export interface ReviewResponse {
  _id: string;
  user: {
    _id: string;
    name: string;
  };
  rating: number;
  comment: string;
  verifiedPurchase: boolean;
  helpfulVotes: number;
  createdAt: Date;
}

export interface ProductReviewsResponse {
  reviews: ReviewResponse[];
  summary: {
    averageRating: number;
    totalReviews: number;
    ratingDistribution: RatingDistribution;
    verifiedPurchases: number;
  };
  pagination: {
    currentPage: number;
    totalPages: number;
    totalReviews: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}
