import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  outputFileTracingIncludes: {
    "/api/icons/[slug]": ["./icons/**/*", "./generated/**/*"],
  },
};

export default nextConfig;
