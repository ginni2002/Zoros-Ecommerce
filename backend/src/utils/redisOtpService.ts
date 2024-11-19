import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();
const requiredEnvVars = ["REDIS_HOST", "REDIS_PORT", "REDIS_PASSWORD"];
const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);
if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required Redis environment variables: ${missingEnvVars.join(", ")}`
  );
}

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
});

redis.on("error", (error) => {
  console.error("Redis connection error:", error);
});

redis.on("connect", () => {
  console.log("Redis connected successfully");
});

const OTP_PREFIX = "admin:otp:";
const OTP_EXPIRY = 300; // 5 min

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const saveOTP = async (email: string, otp: string): Promise<void> => {
  const key = `${OTP_PREFIX}${email}`;
  await redis.set(key, otp, "EX", OTP_EXPIRY);
};

export const verifyOTP = async (
  email: string,
  otp: string
): Promise<boolean> => {
  const key = `${OTP_PREFIX}${email}`;
  const storedOTP = await redis.get(key);

  if (storedOTP === otp) {
    await redis.del(key);
    return true;
  }
  return false;
};

export const deleteOTP = async (email: string): Promise<void> => {
  const key = `${OTP_PREFIX}${email}`;
  await redis.del(key);
};

export default {
  generateOTP,
  saveOTP,
  verifyOTP,
  deleteOTP,
};
