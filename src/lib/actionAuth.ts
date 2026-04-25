import 'server-only'
import { auth } from '~/lib/auth'

// Tiny composable helpers used by every server action. NextAuth caches the
// session per-request, so chaining `requireSession()` from the higher-level
// helpers below does NOT cause a second auth lookup.

export async function requireSession() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  return session
}

export async function requireAdmin() {
  const session = await requireSession()
  if (session.user.role !== 'ADMIN') throw new Error('Admin only')
  return session
}

/**
 * Pure policy check on an already-fetched order. Each call site keeps control
 * over its own `select` shape — only the auth + role check is shared.
 */
export async function requireOrderCreatorOrAdmin(order: { createdById: string }) {
  const session = await requireSession()
  if (order.createdById !== session.user.id && session.user.role !== 'ADMIN') {
    throw new Error('Unauthorized')
  }
  return session
}
