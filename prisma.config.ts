import dotenv from 'dotenv'
import { defineConfig } from 'prisma/config'

// Load .env first (prod defaults), then .env.local on top (sandbox overrides).
// Mirrors Next.js precedence so Prisma CLI and the app resolve DATABASE_URL the same way.
dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local', override: true })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'npx tsx prisma/seed.ts',
  },
})
