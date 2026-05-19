import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    domains: ["d37anhmjei4vts.cloudfront.net"],
  },
};

export default nextConfig;
