import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN is required"),
  CLIENT_ID: z.string().min(1, "CLIENT_ID is required"),
  GUILD_ID: z.string().min(1, "GUILD_ID is required"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_PATH: z.string().default("./data/sounddeck.sqlite"),
  SOUNDS_PATH: z.string().default("./sounds")
});

export const env = envSchema.parse(process.env);
