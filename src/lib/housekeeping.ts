import { prisma } from './prisma'

const THROTTLE_MS = 24 * 60 * 60 * 1000
const ACTIVITY_LOG_MAX_AGE_DAYS = 365
const ACCESS_REQUEST_MAX_AGE_DAYS = 90
const PENDING_LINK_MAX_AGE_DAYS = 90
const INVITATION_MAX_AGE_DAYS = 30

const SINGLETON_ID = 'singleton'

let inFlight: Promise<void> | null = null

async function performHousekeeping() {
  const now = Date.now()
  const activityLogCutoff = new Date(now - ACTIVITY_LOG_MAX_AGE_DAYS * 24 * 60 * 60 * 1000)
  const accessRequestCutoff = new Date(now - ACCESS_REQUEST_MAX_AGE_DAYS * 24 * 60 * 60 * 1000)
  const pendingLinkCutoff = new Date(now - PENDING_LINK_MAX_AGE_DAYS * 24 * 60 * 60 * 1000)
  const invitationCutoff = new Date(now - INVITATION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000)

  await prisma.$transaction([
    prisma.orderActivityLog.deleteMany({
      where: { createdAt: { lt: activityLogCutoff } },
    }),
    prisma.accessRequest.deleteMany({
      where: {
        status: { in: ['approved', 'denied'] },
        createdAt: { lt: accessRequestCutoff },
      },
    }),
    prisma.pendingDiscordLink.deleteMany({
      where: {
        resolvedAt: { not: null, lt: pendingLinkCutoff },
      },
    }),
    prisma.invitation.deleteMany({
      where: {
        usedAt: null,
        expiresAt: { lt: invitationCutoff },
      },
    }),
  ])
}

export async function runHousekeeping(): Promise<void> {
  if (inFlight) return inFlight

  inFlight = (async () => {
    try {
      const cutoff = new Date(Date.now() - THROTTLE_MS)
      const marker = await prisma.housekeeping.findUnique({ where: { id: SINGLETON_ID } })

      if (marker && marker.lastRunAt > cutoff) return

      await performHousekeeping()

      await prisma.housekeeping.upsert({
        where: { id: SINGLETON_ID },
        create: { id: SINGLETON_ID, lastRunAt: new Date() },
        update: { lastRunAt: new Date() },
      })
    } catch (err) {
      console.error('[housekeeping] failed:', err)
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}
