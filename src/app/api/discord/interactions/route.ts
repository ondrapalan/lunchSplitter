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
    if (!customId?.startsWith('confirm-payment:')) {
      return Response.json({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: { content: 'Unknown interaction', components: [] },
      })
    }

    const orderPersonId = customId.replace('confirm-payment:', '')
    const discordUserId = interaction.member?.user?.id ?? interaction.user?.id

    try {
      // Verify the Discord user matches the person's linked user
      const orderPerson = await prisma.orderPerson.findUnique({
        where: { id: orderPersonId },
        include: { user: { select: { discordId: true } } },
      })

      if (!orderPerson || orderPerson.user?.discordId !== discordUserId) {
        return Response.json({
          type: InteractionResponseType.UPDATE_MESSAGE,
          data: {
            content: 'You are not authorized to confirm this payment.',
            components: [],
          },
        })
      }

      // Create or update the payment confirmation
      await prisma.paymentConfirmation.upsert({
        where: { orderPersonId },
        create: {
          orderPersonId,
          confirmedVia: 'discord',
          discordMessageId: interaction.message?.id ?? null,
        },
        update: {
          confirmedVia: 'discord',
          confirmedAt: new Date(),
        },
      })

      // Respond by updating the message to show confirmed
      return Response.json({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: {
          embeds: interaction.message?.embeds?.map((embed: Record<string, unknown>) => ({
            ...embed,
            color: 0x178043, // Green - positive color from theme
            title: embed.title ? `${embed.title}` : undefined,
            description: `~~${embed.description ?? ''}~~\n\n**Payment confirmed!**`,
          })) ?? [],
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 3,
                  label: 'Payment Confirmed',
                  custom_id: `confirm-payment:${orderPersonId}`,
                  disabled: true,
                },
              ],
            },
          ],
        },
      })
    } catch (err) {
      console.error('Failed to process payment confirmation:', err)
      return Response.json({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: {
          content: 'Something went wrong. Please try again later.',
          components: [],
        },
      })
    }
  }

  return Response.json({ type: InteractionResponseType.PONG })
}
