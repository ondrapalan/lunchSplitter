import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock the Discord wrapper before importing sekackaCore so the in-process
// network calls become assertable spies and tests stay hermetic.
vi.mock('~/lib/discord', () => ({
  sendChannelMessage: vi.fn(async () => ({ id: 'dry-run' })),
  editChannelMessage: vi.fn(async () => ({ id: 'dry-run' })),
  sendPendingLinkDm: vi.fn(async () => ({ id: 'dry-run' })),
  isDiscordConfigured: vi.fn(() => true),
}))

import { prisma } from '~/lib/prisma'
import {
  addSekackaParticipant,
  removeSekackaParticipant,
  recordPendingDiscordLink,
  SekackaError,
} from './sekackaCore'
import { sendPendingLinkDm } from '~/lib/discord'

const dbUrl = process.env.DATABASE_URL ?? ''
const isLocalSandbox = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
const describeDb = isLocalSandbox ? describe : describe.skip

if (!isLocalSandbox) {
  console.warn(
    '[sekackaCore.test] DATABASE_URL does not point to localhost; DB-backed suite skipped. ' +
      'Run `docker compose up -d` and ensure .env.local has a sandbox DATABASE_URL.',
  )
}

let nonceCounter = 0
function nonce(): string {
  nonceCounter += 1
  return `${Date.now().toString(36)}-${nonceCounter}`
}

interface TestFixture {
  restaurantId: string
  creatorUserId: string
  orderId: string
  creatorPersonId: string
  /** Track every entity we create so afterEach can tear it all down. */
  cleanup: {
    extraUserIds: string[]
    extraPendingLinkDiscordIds: string[]
  }
}

async function buildSekacka(): Promise<TestFixture> {
  const tag = nonce()
  const restaurant = await prisma.restaurant.create({
    data: { name: `Test Restaurant ${tag}` },
  })
  const creator = await prisma.user.create({
    data: {
      username: `creator-${tag}`,
      displayName: 'Creator',
      passwordHash: 'irrelevant',
      role: 'USER',
    },
  })
  const order = await prisma.order.create({
    data: {
      restaurantId: restaurant.id,
      createdById: creator.id,
      type: 'SEKACKA',
      status: 'OPEN',
    },
  })
  const creatorPerson = await prisma.orderPerson.create({
    data: {
      orderId: order.id,
      userId: creator.id,
      name: 'Creator',
      sortOrder: 0,
    },
  })
  return {
    restaurantId: restaurant.id,
    creatorUserId: creator.id,
    orderId: order.id,
    creatorPersonId: creatorPerson.id,
    cleanup: { extraUserIds: [], extraPendingLinkDiscordIds: [] },
  }
}

async function tearDown(fx: TestFixture): Promise<void> {
  // PendingDiscordLink.triggeredByOrder uses SetNull, so links survive the
  // order delete — clear them by Discord id (the ones created by tests) and
  // by triggeredByOrderId (catch-all for anything we missed).
  if (fx.cleanup.extraPendingLinkDiscordIds.length > 0) {
    await prisma.pendingDiscordLink.deleteMany({
      where: { discordId: { in: fx.cleanup.extraPendingLinkDiscordIds } },
    })
  }
  await prisma.pendingDiscordLink.deleteMany({ where: { triggeredByOrderId: fx.orderId } })
  // Order cascade kills FeeAdjustment, OrderPerson, OrderItem, SharedItemLink,
  // CustomShare, PaymentConfirmation, OrderActivityLog.
  await prisma.order.delete({ where: { id: fx.orderId } }).catch(() => null)
  // Users have no remaining FK refs (no orders, no persons, no activity), safe to drop.
  for (const uid of [fx.creatorUserId, ...fx.cleanup.extraUserIds]) {
    await prisma.user.delete({ where: { id: uid } }).catch(() => null)
  }
  await prisma.restaurant.delete({ where: { id: fx.restaurantId } }).catch(() => null)
}

describeDb('sekackaCore (sandbox DB)', () => {
  let fx: TestFixture

  beforeEach(async () => {
    vi.clearAllMocks()
    fx = await buildSekacka()
  })

  afterEach(async () => {
    await tearDown(fx)
  })

  describe('addSekackaParticipant', () => {
    it('is idempotent — second call returns added=false and creates no duplicate person', async () => {
      const tag = nonce()
      const joiner = await prisma.user.create({
        data: { username: `joiner-${tag}`, displayName: 'Joiner', passwordHash: 'x', role: 'USER' },
      })
      fx.cleanup.extraUserIds.push(joiner.id)

      const first = await addSekackaParticipant(fx.orderId, joiner.id, { source: 'WEB', actorUserId: joiner.id })
      const second = await addSekackaParticipant(fx.orderId, joiner.id, { source: 'WEB', actorUserId: joiner.id })

      expect(first.added).toBe(true)
      expect(second.added).toBe(false)
      expect(second.personId).toBe(first.personId)

      const persons = await prisma.orderPerson.findMany({
        where: { orderId: fx.orderId, userId: joiner.id },
      })
      expect(persons).toHaveLength(1)
    })

    it('creates SharedItemLink rows for every creator-owned OrderItem', async () => {
      // Seed two creator items
      await prisma.orderItem.createMany({
        data: [
          { name: 'Sekana 1', price: 80, sortOrder: 0, personId: fx.creatorPersonId },
          { name: 'Sekana 2', price: 90, sortOrder: 1, personId: fx.creatorPersonId },
        ],
      })

      const tag = nonce()
      const joiner = await prisma.user.create({
        data: { username: `joiner-${tag}`, displayName: 'Joiner', passwordHash: 'x', role: 'USER' },
      })
      fx.cleanup.extraUserIds.push(joiner.id)

      const result = await addSekackaParticipant(fx.orderId, joiner.id, { source: 'DISCORD', actorUserId: joiner.id })

      const links = await prisma.sharedItemLink.findMany({ where: { personId: result.personId } })
      expect(links).toHaveLength(2)
    })

    it('writes a JOINED activity log entry for DISCORD source', async () => {
      const tag = nonce()
      const joiner = await prisma.user.create({
        data: { username: `joiner-${tag}`, displayName: 'Joiner', passwordHash: 'x', role: 'USER' },
      })
      fx.cleanup.extraUserIds.push(joiner.id)

      await addSekackaParticipant(fx.orderId, joiner.id, { source: 'DISCORD', actorUserId: joiner.id })

      const logs = await prisma.orderActivityLog.findMany({ where: { orderId: fx.orderId, action: 'JOINED' } })
      expect(logs).toHaveLength(1)
      expect(logs[0].source).toBe('DISCORD')
      expect(logs[0].targetUserId).toBe(joiner.id)
    })

    it('writes a MANUAL_ADDED activity log entry for ADMIN source', async () => {
      const tag = nonce()
      const joiner = await prisma.user.create({
        data: { username: `joiner-${tag}`, displayName: 'Joiner', passwordHash: 'x', role: 'USER' },
      })
      fx.cleanup.extraUserIds.push(joiner.id)

      await addSekackaParticipant(fx.orderId, joiner.id, { source: 'ADMIN', actorUserId: fx.creatorUserId })

      const logs = await prisma.orderActivityLog.findMany({
        where: { orderId: fx.orderId, action: 'MANUAL_ADDED' },
      })
      expect(logs).toHaveLength(1)
      expect(logs[0].source).toBe('ADMIN')
    })

    it('rejects with CLOSED when status is CLOSED', async () => {
      await prisma.order.update({ where: { id: fx.orderId }, data: { status: 'CLOSED' } })
      const tag = nonce()
      const joiner = await prisma.user.create({
        data: { username: `joiner-${tag}`, displayName: 'Joiner', passwordHash: 'x', role: 'USER' },
      })
      fx.cleanup.extraUserIds.push(joiner.id)

      await expect(
        addSekackaParticipant(fx.orderId, joiner.id, { source: 'WEB', actorUserId: joiner.id }),
      ).rejects.toMatchObject({ name: 'SekackaError', code: 'CLOSED' })
    })

    it('rejects with NOT_SEKACKA on a NORMAL order', async () => {
      await prisma.order.update({ where: { id: fx.orderId }, data: { type: 'NORMAL' } })
      const tag = nonce()
      const joiner = await prisma.user.create({
        data: { username: `joiner-${tag}`, displayName: 'Joiner', passwordHash: 'x', role: 'USER' },
      })
      fx.cleanup.extraUserIds.push(joiner.id)

      await expect(
        addSekackaParticipant(fx.orderId, joiner.id, { source: 'WEB', actorUserId: joiner.id }),
      ).rejects.toMatchObject({ name: 'SekackaError', code: 'NOT_SEKACKA' })
    })
  })

  describe('removeSekackaParticipant', () => {
    it('rejects removing the creator with FORBIDDEN', async () => {
      await expect(
        removeSekackaParticipant(fx.orderId, fx.creatorUserId, { source: 'WEB', actorUserId: fx.creatorUserId }),
      ).rejects.toMatchObject({ name: 'SekackaError', code: 'FORBIDDEN' })
    })

    it('returns removed=false for a non-participant', async () => {
      const tag = nonce()
      const stranger = await prisma.user.create({
        data: { username: `stranger-${tag}`, displayName: 'Stranger', passwordHash: 'x', role: 'USER' },
      })
      fx.cleanup.extraUserIds.push(stranger.id)

      const result = await removeSekackaParticipant(fx.orderId, stranger.id, {
        source: 'WEB',
        actorUserId: stranger.id,
      })
      expect(result.removed).toBe(false)
    })

    it('removes a real participant and writes a LEFT log entry', async () => {
      const tag = nonce()
      const joiner = await prisma.user.create({
        data: { username: `joiner-${tag}`, displayName: 'Joiner', passwordHash: 'x', role: 'USER' },
      })
      fx.cleanup.extraUserIds.push(joiner.id)
      await addSekackaParticipant(fx.orderId, joiner.id, { source: 'WEB', actorUserId: joiner.id })

      const result = await removeSekackaParticipant(fx.orderId, joiner.id, {
        source: 'DISCORD',
        actorUserId: joiner.id,
      })
      expect(result.removed).toBe(true)

      const remaining = await prisma.orderPerson.findMany({ where: { orderId: fx.orderId, userId: joiner.id } })
      expect(remaining).toHaveLength(0)

      const logs = await prisma.orderActivityLog.findMany({ where: { orderId: fx.orderId, action: 'LEFT' } })
      expect(logs).toHaveLength(1)
    })
  })

  describe('recordPendingDiscordLink', () => {
    it('upserts the pending link and DMs admins on the first sighting', async () => {
      const tag = nonce()
      const adminDiscordId = `99${tag.replace(/[^0-9]/g, '').padEnd(16, '0').slice(0, 16)}`
      const admin = await prisma.user.create({
        data: {
          username: `admin-${tag}`,
          displayName: 'Admin',
          passwordHash: 'x',
          role: 'ADMIN',
          discordId: adminDiscordId,
        },
      })
      fx.cleanup.extraUserIds.push(admin.id)

      const clickerDiscordId = `${tag.replace(/[^0-9]/g, '').padEnd(17, '0').slice(0, 17)}`
      fx.cleanup.extraPendingLinkDiscordIds.push(clickerDiscordId)

      await recordPendingDiscordLink(fx.orderId, {
        id: clickerDiscordId,
        username: 'clicky',
        globalName: 'Clicky',
        nick: null,
      })

      const link = await prisma.pendingDiscordLink.findUnique({ where: { discordId: clickerDiscordId } })
      expect(link).not.toBeNull()
      expect(link?.discordUsername).toBe('clicky')
      expect(sendPendingLinkDm).toHaveBeenCalledTimes(1)
    })

    it('skips the DM on a repeat click while the link is still unresolved', async () => {
      const tag = nonce()
      const admin = await prisma.user.create({
        data: {
          username: `admin-${tag}`,
          displayName: 'Admin',
          passwordHash: 'x',
          role: 'ADMIN',
          discordId: `88${tag.replace(/[^0-9]/g, '').padEnd(16, '0').slice(0, 16)}`,
        },
      })
      fx.cleanup.extraUserIds.push(admin.id)

      const clickerDiscordId = `7${tag.replace(/[^0-9]/g, '').padEnd(18, '0').slice(0, 18)}`
      fx.cleanup.extraPendingLinkDiscordIds.push(clickerDiscordId)

      await recordPendingDiscordLink(fx.orderId, {
        id: clickerDiscordId,
        username: 'clicky',
        globalName: 'Clicky',
        nick: null,
      })
      await recordPendingDiscordLink(fx.orderId, {
        id: clickerDiscordId,
        username: 'clicky',
        globalName: 'Clicky',
        nick: 'NewNick',
      })

      // Only the first call should have triggered an admin DM — the second is a
      // repeat click on an unresolved link and must short-circuit per the
      // sekackaCore guard `if (existing && !existing.resolvedAt) return`.
      expect(sendPendingLinkDm).toHaveBeenCalledTimes(1)

      // But the upsert should still update the nick on the second call.
      const link = await prisma.pendingDiscordLink.findUnique({ where: { discordId: clickerDiscordId } })
      expect(link?.discordNick).toBe('NewNick')
    })

    it('does not throw when there are no admins to DM', async () => {
      const tag = nonce()
      const clickerDiscordId = `5${tag.replace(/[^0-9]/g, '').padEnd(18, '0').slice(0, 18)}`
      fx.cleanup.extraPendingLinkDiscordIds.push(clickerDiscordId)

      await expect(
        recordPendingDiscordLink(fx.orderId, {
          id: clickerDiscordId,
          username: 'lonely',
          globalName: null,
          nick: null,
        }),
      ).resolves.toBeUndefined()
    })
  })

  it('SekackaError preserves its code via toMatchObject (sanity)', () => {
    const err = new SekackaError('CLOSED', 'closed')
    expect(err.code).toBe('CLOSED')
  })
})
