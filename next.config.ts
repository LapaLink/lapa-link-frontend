import type { NextConfig } from "next"
import { getBackendUrl } from "./lib/config/server"

const backend = new URL(getBackendUrl())

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "gjdundmbdqssiftnhuqd.supabase.co",
        pathname: "/storage/v1/object/public/images/**",
      },
    ],
  },

  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backend.origin}/api/v1/:path*`,
      },
    ]
  },
}

export default nextConfig
