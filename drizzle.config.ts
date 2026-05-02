import { defineConfig } from "drizzle-kit";
import "dotenv/config";
import { ENV } from "./src/utils/env_constants";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/models/*",
  out: "./drizzle",
  dbCredentials: {
    url: ENV.DATABASE_URL!,
  },
});
