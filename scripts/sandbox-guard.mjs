// Refuse to run sandbox-destructive commands against anything that isn't a
// localhost Postgres. Run BEFORE `prisma db push` / `prisma db seed` in the
// sandbox:* scripts so a missing .env.local can't nuke the Neon prod DB.
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

const url = process.env.DATABASE_URL ?? ''
const isLocal = /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(url)

if (!isLocal) {
  const redacted = url.replace(/\/\/[^@]+@/, '//***:***@')
  console.error(
    `[sandbox-guard] DATABASE_URL does not point at localhost — refusing to run.\n` +
    `  Resolved: ${redacted || '(empty)'}\n` +
    `  Fix: uncomment the sandbox profile block in .env.local (see .env.example).`
  )
  process.exit(1)
}

console.log('[sandbox-guard] DATABASE_URL is local — OK.')
