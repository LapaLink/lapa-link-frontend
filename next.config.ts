import type { NextConfig } from "next"
import { getBackendUrl } from "./lib/config/server"
import { getConfiguredChatSocketUrl } from "./lib/config/chat"

const backend = new URL(getBackendUrl())
// Fail the build on an invalid public chat socket URL.
getConfiguredChatSocketUrl()

const nextConfig: NextConfig = {
  images: { remotePatterns: [] },

  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backend.origin}/api/v1/:path*`,
      },
      // Chat STOMP socket. `next start`/`next dev` proxy the WebSocket upgrade
      // for external rewrites. Hosts without WebSocket proxying (Netlify,
      // Vercel) need NEXT_PUBLIC_CHAT_WS_URL=wss://<backend>/ws at build time
      // instead, and the backend's APP_FRONT_ADDRESS must list the site origin.
      // A reverse proxy in front of Next or the backend (nginx) must forward
      // the upgrade for /ws:
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
