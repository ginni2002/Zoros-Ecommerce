import { Schema, model } from "mongoose";
import { ISellerProduct } from "../types/sellerProduct.types";
import { ProductCategory } from "../types/product.types";

const sellerProductSchema = new Schema<ISellerProduct>(
  {
    seller: {
      type: Schema.Types.ObjectId,
      ref: "Seller",
      required: [true, "Seller reference is required"],
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [3, "Name must be at least 3 characters"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price must be positive"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: {
        values: Object.values(ProductCategory),
        message: "Invalid category",
      },
    },
    brand: {
      type: String,
      required: [true, "Brand is required"],
      trim: true,
    },
    imageUrl: {
      type: String,
      required: [true, "Image URL is required"],
      trim: true,
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Stock cannot be negative"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    specifications: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
    ratings: {
      average: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      count: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
sellerProductSchema.index({ seller: 1 });
sellerProductSchema.index({ name: "text", description: "text" });
sellerProductSchema.index({ category: 1 });
sellerProductSchema.index({ brand: 1 });
sellerProductSchema.index({ price: 1 });
sellerProductSchema.index({ isActive: 1 });
sellerProductSchema.index({ seller: 1, category: 1 });
sellerProductSchema.index({ seller: 1, isActive: 1 });

sellerProductSchema.virtual("isInStock").get(function (this: ISellerProduct) {
  return this.stock > 0 && this.isActive;
});

sellerProductSchema.methods.updateStock = async function (
  quantity: number
): Promise<void> {
  this.stock += quantity;
  if (this.stock < 0) {
    this.stock = 0;
  }
  await this.save();
};

sellerProductSchema.pre("save", function (next) {
  if (this.isModified("price") && this.price < 0) this.price = 0;
  if (this.isModified("stock") && this.stock < 0) this.stock = 0;
  next();
});

const SellerProduct = model<ISellerProduct>(
  "SellerProduct",
  sellerProductSchema
);

export default SellerProduct;
