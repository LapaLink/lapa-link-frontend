import type { NextConfig } from "next"
import { getBackendUrl } from "./lib/config/server"

const backend = new URL(getBackendUrl())

const nextConfig: NextConfig = {
  images: { remotePatterns: [] },

  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backend.origin}/api/v1/:path*`,
      },
      // Chat STOMP socket. `next start`/`next dev` proxy the WebSocket upgrade
      // for external rewrites. A reverse proxy in front of Next (nginx) must
      // forward the upgrade for /ws too:
      //   proxy_http_version 1.1;
      //   proxy_set_header Upgrade $http_upgrade;
      //   proxy_set_header Connection "upgrade";
      //   proxy_read_timeout 60s; # longer than the 10s STOMP heart-beat
      // The backend accepts only origins listed in APP_FRONT_ADDRESS.
      {
        source: "/ws",
        destination: `${backend.origin}/ws`,
      },
    ]
  },
}

export default nextConfig
