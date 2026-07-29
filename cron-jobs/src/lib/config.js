import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new Error(`Missing required env: ${name}`);
  }
  return v;
}

export function getConfig() {
  const baseUrl = requireEnv("OCEANE_MARINE_BASE_URL").replace(/\/+$/, "");
  const cronSecret = requireEnv("CRON_SECRET");
  const timezone = process.env.CRON_TZ?.trim() || "UTC";

  return {
    baseUrl,
    cronSecret,
    timezone,
  };
}
