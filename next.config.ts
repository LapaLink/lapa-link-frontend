import type { NextConfig } from "next"
import { getBackendUrl } from "./lib/config/server"

const backend = new URL(getBackendUrl())

const imageStorageUrl = process.env.IMAGE_STORAGE_URL
const imageStorage = imageStorageUrl ? new URL(imageStorageUrl) : null

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: backend.protocol.replace(":", "") as "http" | "https",
        hostname: backend.hostname,
        port: backend.port,
        pathname: "/images/**",
      },

      ...(imageStorage
        ? [
            {
              protocol: imageStorage.protocol.replace(":", "") as
                | "http"
                | "https",
              hostname: imageStorage.hostname,
              port: imageStorage.port,
              pathname: imageStorage.hostname.includes("supabase.co")
                ? "/storage/v1/object/public/images/**"
                : "/images/**",
            },
          ]
        : []),
    ],
  },

  async rewrites() {
    const rewrites = [
      {
        source: "/api/v1/:path*",
        destination: `${backend.origin}/api/v1/:path*`,
      },
    ]

    if (
      imageStorage &&
      !imageStorage.hostname.includes("supabase.co")
    ) {
      rewrites.push({
        source: "/images/:path*",
        destination: `${imageStorage.origin}/images/:path*`,
      })
    }

    return rewrites
  },
}

export default nextConfig
