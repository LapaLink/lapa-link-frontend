import type { NextConfig } from "next"
import { getBackendUrl } from "./lib/config/server"

const backend = new URL(getBackendUrl())
const imageStorage = new URL(
  process.env.IMAGE_STORAGE_URL ?? "http://localhost:9010",
)

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: backend.protocol.replace(":", "") as "http" | "https",
        hostname: backend.hostname,
        port: backend.port,
        pathname: "/images/**",
      },
      {
        protocol: imageStorage.protocol.replace(":", "") as "http" | "https",
        hostname: imageStorage.hostname,
        port: imageStorage.port,
        pathname: "/images/**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backend.origin}/api/v1/:path*`,
      },
      {
        source: "/images/:path*",
        destination: `${imageStorage.origin}/images/:path*`,
      },
    ]
  },
}

export default nextConfig
