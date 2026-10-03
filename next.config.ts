import type { NextConfig } from "next"
import { getBackendUrl } from "./lib/config/server"

const nextConfig: NextConfig = {
  async rewrites() {
    const backend = getBackendUrl()
    return [
      { source: "/api/v1/:path*", destination: `${backend}/api/v1/:path*` },
    ]
  },
}

export default nextConfig
