import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

// Debug log
// console.log("Environment variables:", {
//   hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
//   envKeys: Object.keys(process.env),
// });

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not defined in environment variables");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-10-28.acacia",
});

export const createPaymentIntent = async (
  amount: number
): Promise<{ clientSecret: string; paymentIntentId: string }> => {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // paise
    currency: "inr",
    automatic_payment_methods: {
      enabled: true,
    },
  });

  console.log("Created Stripe Payment Intent:", {
    id: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    amount: paymentIntent.amount,
    status: paymentIntent.status,
  });

  return {
    clientSecret: paymentIntent.client_secret!,
    paymentIntentId: paymentIntent.id,
  };
};

export const retrievePaymentIntent = async (paymentIntentId: string) => {
  return stripe.paymentIntents.retrieve(paymentIntentId);
};

export default stripe;
