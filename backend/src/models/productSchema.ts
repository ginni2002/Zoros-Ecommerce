import { Schema, model } from "mongoose";
import { IProduct, ProductCategory } from "../types/product.types";

const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
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

productSchema.index({ name: "text", description: "text" });
productSchema.index({ category: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ price: 1 });

productSchema.virtual("isInStock").get(function () {
  return this.stock > 0;
});

productSchema.methods.updateStock = async function (quantity: number) {
  this.stock += quantity;
  return this.save();
};

productSchema.statics.findByCategory = function (category: string) {
  return this.find({ category });
};

const Product = model<IProduct>("Product", productSchema);

export default Product;
