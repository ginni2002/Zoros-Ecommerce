import { Schema, model, Types } from "mongoose";
import crypto from "crypto";
import { ISeller, SellerStatus } from "../types/seller.types";

const businessDetailsSchema = new Schema({
  businessName: {
    type: String,
    required: [true, "Business name is required"],
    trim: true,
    minlength: [2, "Business name must be at least 2 characters"],
  },
  gstNumber: {
    type: String,
    required: [true, "GST number is required"],
    unique: true,
    uppercase: true,
    match: [
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      "Invalid GST number",
    ],
  },
  businessAddress: {
    street: {
      type: String,
      required: [true, "Street address is required"],
      trim: true,
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
    },
    state: {
      type: String,
      required: [true, "State is required"],
      trim: true,
    },
    pincode: {
      type: String,
      required: [true, "Pincode is required"],
      match: [/^[0-9]{6}$/, "Invalid pincode"],
    },
  },
  businessPhone: {
    type: String,
    required: [true, "Business phone is required"],
    match: [/^[0-9]{10}$/, "Invalid phone number"],
  },
  businessEmail: {
    type: String,
    required: [true, "Business email is required"],
    unique: true,
    trim: true,
    lowercase: true,
  },
});

const sellerSchema = new Schema<ISeller>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    businessDetails: businessDetailsSchema,
    status: {
      type: String,
      enum: Object.values(SellerStatus),
      default: SellerStatus.PENDING,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    storeDescription: {
      type: String,
      trim: true,
      maxlength: [500, "Store description cannot exceed 500 characters"],
    },
    totalProducts: {
      type: Number,
      default: 0,
    },
    totalOrders: {
      type: Number,
      default: 0,
    },
    totalRevenue: {
      type: Number,
      default: 0,
    },
    monthlyRevenue: {
      type: Map,
      of: Number,
      default: new Map(),
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

sellerSchema.index({ user: 1 }, { unique: true });
sellerSchema.index({ "businessDetails.gstNumber": 1 }, { unique: true });
sellerSchema.index({ "businessDetails.businessEmail": 1 }, { unique: true });

sellerSchema.virtual("verificationStatus").get(function (this: ISeller) {
  if (this.status === SellerStatus.REJECTED) return "Rejected";
  if (!this.isEmailVerified) return "Email Verification Pending";
  if (this.status === SellerStatus.PENDING) return "Admin Approval Pending";
  return "Verified";
});

sellerSchema.methods.generateVerificationToken = function () {
  const verificationToken = crypto.randomBytes(32).toString("hex");

  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  return verificationToken;
};

sellerSchema.methods.verifyEmail = async function (token: string) {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  if (
    hashedToken !== this.emailVerificationToken ||
    Date.now() > (this.emailVerificationExpires?.getTime() || 0)
  ) {
    return false;
  }

  this.isEmailVerified = true;
  this.emailVerificationToken = undefined;
  this.emailVerificationExpires = undefined;
  await this.save();

  return true;
};

sellerSchema.post("save", function (error: any, doc: any, next: any) {
  if (error.code === 11000) {
    next(new Error("Business email or GST number already exists"));
  } else {
    next(error);
  }
});

const Seller = model<ISeller>("Seller", sellerSchema);

export default Seller;
