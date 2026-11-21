import { z } from "zod";
const schema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  PERSISTENCE_DRIVER: z.enum(["sqlite", "postgres"]).optional(),
  DATABASE_URL: z.string().optional(),
  APP_SECRET: z.string().optional(),
  SQLITE_PATH: z.string().default(".local/craveloop.sqlite"),
  SESSION_TTL_HOURS: z.coerce.number().positive().max(168).default(24),
  UPLOAD_TTL_MINUTES: z.coerce.number().positive().max(60).default(60),
  CATALOG_MODE: z.literal("synthetic").default("synthetic"),
  DEMO_MODE: z.enum(["true"]).default("true"),
});
export function env() {
  const v = schema.parse(process.env);
  const driver =
    v.PERSISTENCE_DRIVER ?? (v.DATABASE_URL ? "postgres" : "sqlite");
  if (driver === "postgres" && !v.DATABASE_URL)
    throw new Error("DATABASE_URL is required for postgres");
  if (
    process.env.NODE_ENV === "production" &&
    (!v.APP_SECRET || v.APP_SECRET.length < 32)
  )
    throw new Error("APP_SECRET (32+ characters) required in production");
  if (process.env.VERCEL && driver !== "postgres")
    throw new Error("Hosted deployment requires PostgreSQL DATABASE_URL");
  return { ...v, driver };
}
