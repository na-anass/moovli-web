import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    dangerouslyAllowSVG: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "xaujutbtmpdnuqxgpokf.supabase.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
    // Supabase resolves to private IPs in some DNS configs — skip optimization
    unoptimized: true,
  },
};

export default nextConfig;
