import { InteractionType, InteractionResponseType, verifyKey } from 'discord-interactions'
import { prisma } from '~/lib/prisma'

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

  const interaction = JSON.parse(body)

  // Handle PING (Discord endpoint verification)
  if (interaction.type === InteractionType.PING) {
    return Response.json({ type: InteractionResponseType.PONG })
  }

  // Handle button clicks
  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    const customId = interaction.data?.custom_id as string | undefined
    if (!customId) {
      return Response.json({ type: InteractionResponseType.PONG })
    }

    try {
      // --- Payment confirmation ---
      if (customId.startsWith('confirm-payment:')) {
        return await handlePaymentConfirmation(interaction, customId.replace('confirm-payment:', ''))
      }

      // --- Access request approval ---
      if (customId.startsWith('approve-access:')) {
        return await handleAccessRequest(interaction, customId.replace('approve-access:', ''), true)
      }

      // --- Access request denial ---
      if (customId.startsWith('deny-access:')) {
        return await handleAccessRequest(interaction, customId.replace('deny-access:', ''), false)
      }
    } catch (err) {
      console.error('Interaction error:', err)
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

async function handlePaymentConfirmation(interaction: Record<string, unknown>, orderPersonId: string) {
  const discordUserId = (interaction as { member?: { user?: { id: string } }; user?: { id: string } }).member?.user?.id
    ?? (interaction as { user?: { id: string } }).user?.id

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
    create: { orderPersonId, confirmedVia: 'discord', discordMessageId: (interaction as { message?: { id: string } }).message?.id ?? null },
    update: { confirmedVia: 'discord', confirmedAt: new Date() },
  })

  const originalEmbed = ((interaction as { message?: { embeds?: Record<string, unknown>[] } }).message?.embeds?.[0]) as Record<string, unknown> | undefined
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

async function handleAccessRequest(_interaction: Record<string, unknown>, requestId: string, approve: boolean) {
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
