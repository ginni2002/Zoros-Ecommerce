import { Schema, model, Model, Document, Types, CallbackError } from "mongoose";
import { IReview } from "../types/review.types";
import Product from "./productSchema";

// Interface for static methods
interface IReviewModel extends Model<IReview> {
  updateProductRating(productId: string): Promise<void>;
}

// Document type for middleware
type ReviewDocument = Document<unknown, {}, IReview> &
  Omit<IReview, "product"> & {
    product: Types.ObjectId;
  };

const reviewSchema = new Schema<IReview, IReviewModel>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 500,
    },
    verifiedPurchase: {
      type: Boolean,
      default: false,
    },
    helpfulVotes: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Create compound index
reviewSchema.index({ user: 1, product: 1 }, { unique: true });

// Define the static method
reviewSchema.static("updateProductRating", async function (productId: string) {
  const stats = await this.aggregate([
    { $match: { product: new Types.ObjectId(productId) } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        numberOfReviews: { $sum: 1 },
      },
    },
  ]);

  await Product.findByIdAndUpdate(productId, {
    "ratings.average": stats[0]?.averageRating || 0,
    "ratings.count": stats[0]?.numberOfReviews || 0,
  });
});

const Review = model<IReview, IReviewModel>("Review", reviewSchema);

// Post save middleware
reviewSchema.post<ReviewDocument>("save", async function () {
  await Review.updateProductRating(this.product.toString());
});

// Post delete middleware for all delete operations
reviewSchema.post<ReviewDocument>(
  "findOneAndDelete",
  async function (doc: IReview | null) {
    if (doc && doc.product) {
      await Review.updateProductRating(doc.product.toString());
    }
  }
);

reviewSchema.post<ReviewDocument>(
  "deleteOne",
  async function (doc: IReview | null) {
    if (doc && doc.product) {
      await Review.updateProductRating(doc.product.toString());
    }
  }
);

reviewSchema.post<IReview[]>(
  "deleteMany",
  async function (docs: IReview[] | null) {
    if (docs && Array.isArray(docs)) {
      for (const doc of docs) {
        if (doc.product) {
          await Review.updateProductRating(doc.product.toString());
        }
      }
    }
  }
);

export default Review;
