import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "d37anhmjei4vts.cloudfront.net",
      },
    ],
  },
};

export default nextConfig;
