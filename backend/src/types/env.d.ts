declare namespace NodeJS {
  interface ProcessEnv {
    PORT: string;
    MONGO_URI: string;
    STRIPE_SECRET_KEY: string;
    STRIPE_PUBLIC_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
    EMAIL_USER: string;
    EMAIL_APP_PASSWORD: string;
    JWT_SECRET: string;
    JWT_EXPIRE: string;
    FRONTEND_URL: string;
  }
}
