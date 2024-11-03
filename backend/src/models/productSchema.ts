import { Schema, model, Document } from "mongoose";

//types
export interface IProduct extends Document {
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
  stock: number;
  specifications: {
    [key: string]: string | number;
  };
  ratings: {
    average: number;
    count: number;
  };
}

//schema
const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    category: {
      type: String,
      required: true,
      enum: [
        "GRAPHICS_CARD",
        "GAMING_LAPTOP",
        "MOUSE",
        "KEYBOARD",
        "MONITOR",
        "HEADSET",
      ],
    },
    brand: { type: String, required: true },
    imageUrl: { type: String, required: true },
    stock: { type: Number, required: true, default: 0 },
    specifications: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
    ratings: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

const Product = model<IProduct>("Product", productSchema);
export default Product;
