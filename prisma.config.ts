import path from "path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma CLI doesn't read .env.local — load it manually
config({ path: path.join(process.cwd(), ".env.local") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
