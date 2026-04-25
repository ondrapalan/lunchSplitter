import '@testing-library/jest-dom/vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Load .env.local into process.env so DB-backed tests (e.g. sekackaCore) can
// reach the sandbox Postgres without a custom invocation. Pure tests are
// unaffected. Existing process.env values win — CI/explicit env take priority.
const envPath = resolve(process.cwd(), '.env.local')
if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf-8')
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim()
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}
