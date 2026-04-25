import type { NextConfig } from 'next'
import packageJson from './package.json' with { type: 'json' }

const nextConfig: NextConfig = {
  compiler: {
    styledComponents: true,
  },
  env: {
    // Expose the package.json version to the client as a build-time constant
    // (NEXT_PUBLIC_ prefix makes it available in client components).
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
