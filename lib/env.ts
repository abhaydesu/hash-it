import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1),
  // NextAuth URLs
  NEXTAUTH_URL: z.string().url().optional(),
  AUTH_URL: z.string().url().optional(),
  AUTH_TRUST_HOST: z.coerce.boolean().optional(),
  // Google Auth — optional in development/test; required in production (asserted below)
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  // Cron
  CRON_SECRET: z.string().min(1).optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:", _env.error.format());
  throw new Error("Invalid environment variables");
}

if (process.env.NODE_ENV === "production") {
  if (!_env.data.AUTH_GOOGLE_ID?.trim() || !_env.data.AUTH_GOOGLE_SECRET?.trim()) {
    throw new Error(
      "AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are required in production"
    );
  }
}

export const env = _env.data;
