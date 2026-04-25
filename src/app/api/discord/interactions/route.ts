import { InteractionType, InteractionResponseType, verifyKey } from 'discord-interactions'
import { prisma } from '~/lib/prisma'
import {
  addSekackaParticipant,
  removeSekackaParticipant,
  recordPendingDiscordLink,
  SekackaError,
} from '~/lib/sekackaCore'
import { requireDiscordAdmin } from '~/lib/discordAuth'

const EPHEMERAL = 64

function ephemeral(content: string) {
  return Response.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content, flags: EPHEMERAL },
  })
}

interface DiscordUser {
  id: string
  username: string
  global_name?: string | null
}
interface DiscordMember {
  nick?: string | null
  user?: DiscordUser
}
interface DiscordInteraction {
  type: number
  data?: { custom_id?: string }
  member?: DiscordMember
  user?: DiscordUser
  message?: { id: string; embeds?: Record<string, unknown>[] }
}

export async function POST(request: Request) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY
  if (!publicKey) {
    return new Response('Discord not configured', { status: 500 })
  }

  // Get raw body and signature headers
  const body = await request.text()
  const signature = request.headers.get('X-Signature-Ed25519')
  const timestamp = request.headers.get('X-Signature-Timestamp')

  if (!signature || !timestamp) {
    return new Response('Missing signature', { status: 401 })
  }

  // Verify the request is from Discord
  const isValid = await verifyKey(body, signature, timestamp, publicKey)
  if (!isValid) {
    return new Response('Invalid signature', { status: 401 })
  }

  const interaction = JSON.parse(body) as DiscordInteraction

  // Handle PING (Discord endpoint verification)
  if (interaction.type === InteractionType.PING) {
    return Response.json({ type: InteractionResponseType.PONG })
  }

  // Handle button clicks
  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    const customId = interaction.data?.custom_id
    if (!customId) {
      return Response.json({ type: InteractionResponseType.PONG })
    }

    try {
      // --- Payment confirmation ---
      if (customId.startsWith('confirm-payment:')) {
        return await handlePaymentConfirmation(interaction, customId.replace('confirm-payment:', ''))
      }

      // Access-request buttons mutate user accounts, so they require an admin clicker.
      // The Ed25519 verification above only proves the payload came from Discord — not who clicked.
      if (customId.startsWith('approve-access:') || customId.startsWith('deny-access:')) {
        const clickerDiscordId = interaction.member?.user?.id ?? interaction.user?.id
        const adminCheck = await requireDiscordAdmin(clickerDiscordId)
        if (!adminCheck.ok) {
          return ephemeral('You are not authorized to perform this action.')
        }
        if (customId.startsWith('approve-access:')) {
          return await handleAccessRequest(customId.replace('approve-access:', ''), true)
        }
        return await handleAccessRequest(customId.replace('deny-access:', ''), false)
      }

      // --- Sekačka join ---
      if (customId.startsWith('sekacka-join:')) {
        return await handleSekackaJoin(interaction, customId.replace('sekacka-join:', ''))
      }

      // --- Sekačka leave ---
      if (customId.startsWith('sekacka-leave:')) {
        return await handleSekackaLeave(interaction, customId.replace('sekacka-leave:', ''))
      }
    } catch (err) {
      console.error('Interaction error:', err)
      // For Sekačka custom ids we MUST NOT UPDATE_MESSAGE — that wipes the public announcement.
      // Emit an ephemeral error instead; error paths for non-Sekačka ids keep legacy behaviour.
      if (customId.startsWith('sekacka-')) {
        return ephemeral('Something went wrong, please try again.')
      }
      return Response.json({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: { content: 'Something went wrong. Please try again later.', components: [] },
      })
    }

    return Response.json({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: { content: 'Unknown interaction', components: [] },
    })
  }

  return Response.json({ type: InteractionResponseType.PONG })
}

function extractDiscordIdentity(interaction: DiscordInteraction): { discordId: string; username: string; globalName: string | null; nick: string | null } | null {
  const user = interaction.member?.user ?? interaction.user
  if (!user) return null
  return {
    discordId: user.id,
    username: user.username,
    globalName: user.global_name ?? null,
    nick: interaction.member?.nick ?? null,
  }
}

async function handleSekackaJoin(interaction: DiscordInteraction, orderId: string) {
  const identity = extractDiscordIdentity(interaction)
  if (!identity) return ephemeral("Couldn't identify you.")

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, type: true },
  })
  if (!order || order.type !== 'SEKACKA') {
    return ephemeral("This Sekačka no longer exists.")
  }
  if (order.status !== 'OPEN') {
    return ephemeral('Sekačka is already closed.')
  }

  const user = await prisma.user.findUnique({
    where: { discordId: identity.discordId },
    select: { id: true, displayName: true },
  })

  if (!user) {
    await recordPendingDiscordLink(orderId, {
      id: identity.discordId,
      username: identity.username,
      globalName: identity.globalName,
      nick: identity.nick,
    })
    return ephemeral(
      "⚠️ Your Discord isn't linked to an app account yet. " +
      "I've notified the admin — click Popiči again once they link you.",
    )
  }

  try {
    const result = await addSekackaParticipant(orderId, user.id, {
      source: 'DISCORD',
      actorUserId: user.id,
    })
    if (!result.added) {
      return ephemeral("You're already on the list. 🍞")
    }
    return ephemeral('✅ Added you. Enjoy!')
  } catch (err) {
    if (err instanceof SekackaError) {
      if (err.code === 'CLOSED') return ephemeral('Sekačka is already closed.')
      return ephemeral(err.message)
    }
    throw err
  }
}

async function handleSekackaLeave(interaction: DiscordInteraction, orderId: string) {
  const identity = extractDiscordIdentity(interaction)
  if (!identity) return ephemeral("Couldn't identify you.")

  const user = await prisma.user.findUnique({
    where: { discordId: identity.discordId },
    select: { id: true },
  })

  if (!user) {
    return ephemeral("You're not on the list (Discord not linked).")
  }

  try {
    const result = await removeSekackaParticipant(orderId, user.id, {
      source: 'DISCORD',
      actorUserId: user.id,
    })
    if (!result.removed) {
      return ephemeral("You're not on the list.")
    }
    return ephemeral('🚪 Removed you.')
  } catch (err) {
    if (err instanceof SekackaError) {
      if (err.code === 'CLOSED') return ephemeral('Sekačka is already closed.')
      if (err.code === 'FORBIDDEN') return ephemeral("The creator can't leave their own Sekačka.")
      return ephemeral(err.message)
    }
    throw err
  }
}

async function handlePaymentConfirmation(interaction: DiscordInteraction, orderPersonId: string) {
  const discordUserId = interaction.member?.user?.id ?? interaction.user?.id

  const orderPerson = await prisma.orderPerson.findUnique({
    where: { id: orderPersonId },
    include: { user: { select: { discordId: true } } },
  })

  if (!orderPerson || orderPerson.user?.discordId !== discordUserId) {
    return Response.json({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: { content: 'You are not authorized to confirm this payment.', components: [] },
    })
  }

  await prisma.paymentConfirmation.upsert({
    where: { orderPersonId },
    create: { orderPersonId, confirmedVia: 'discord', discordMessageId: interaction.message?.id ?? null },
    update: { confirmedVia: 'discord', confirmedAt: new Date() },
  })

  const originalEmbed = interaction.message?.embeds?.[0] as Record<string, unknown> | undefined
  return Response.json({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: {
      embeds: [{
        title: originalEmbed?.title ?? 'Payment',
        description: `~~${originalEmbed?.description ?? ''}~~\n\n**Payment confirmed!**`,
        color: 0x178043,
      }],
      components: [{
        type: 1,
        components: [{ type: 2, style: 3, label: 'Payment Confirmed', custom_id: `confirm-payment:${orderPersonId}`, disabled: true }],
      }],
      attachments: [],
    },
  })
}

async function handleAccessRequest(requestId: string, approve: boolean) {
  const request = await prisma.accessRequest.findUnique({ where: { id: requestId } })
  if (!request || request.status !== 'pending') {
    return Response.json({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        embeds: [{ title: 'Access Request', description: 'This request has already been processed.', color: 0x5A6978 }],
        components: [],
      },
    })
  }

  if (approve) {
    // Check username isn't taken
    const existing = await prisma.user.findUnique({ where: { username: request.username } })
    if (existing) {
      await prisma.accessRequest.update({ where: { id: requestId }, data: { status: 'denied' } })
      return Response.json({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: {
          embeds: [{ title: 'Access Request', description: `Could not approve — username \`${request.username}\` is already taken.`, color: 0xD32F2F }],
          components: [],
        },
      })
    }

    await prisma.$transaction([
      prisma.user.create({
        data: {
          username: request.username,
          displayName: request.displayName,
          passwordHash: request.passwordHash,
          isFirstLogin: false,
        },
      }),
      prisma.accessRequest.update({ where: { id: requestId }, data: { status: 'approved' } }),
    ])

    return Response.json({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        embeds: [{
          title: 'Access Request — Approved',
          description: `**${request.displayName}** (\`${request.username}\`) has been approved and can now log in.`,
          color: 0x178043,
        }],
        components: [],
      },
    })
  } else {
    await prisma.accessRequest.update({ where: { id: requestId }, data: { status: 'denied' } })

    return Response.json({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        embeds: [{
          title: 'Access Request — Denied',
          description: `Request from **${request.displayName}** (\`${request.username}\`) was denied.`,
          color: 0xD32F2F,
        }],
        components: [],
      },
    })
  }
}
