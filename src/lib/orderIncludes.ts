// Shared Prisma include tree for fetching the full order graph (restaurant +
// fee adjustments + people + items + shares). discordId is selected on every
// linked user so the mapper can derive `hasDiscord` for any caller.

export const baseOrderInclude = {
  restaurant: true,
  feeAdjustments: { orderBy: { sortOrder: 'asc' as const } },
  people: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      user: { select: { displayName: true, discordId: true } },
      guest: { select: { name: true } },
      items: {
        orderBy: { sortOrder: 'asc' as const },
        include: {
          sharedWith: true,
          customShares: true,
        },
      },
    },
  },
}

export const orderIncludeWithDiscordId = baseOrderInclude
