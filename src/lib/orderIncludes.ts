// Shared Prisma include trees for fetching the full order graph (restaurant +
// fee adjustments + people + items + shares). Two variants exist because the
// Discord notification path needs `discordId` on each linked user, while the
// stats path doesn't. Don't inline these — the shape was already drifting
// between callers before this was extracted.

export const baseOrderInclude = {
  restaurant: true,
  feeAdjustments: { orderBy: { sortOrder: 'asc' as const } },
  people: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      user: { select: { displayName: true } },
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

export const orderIncludeWithDiscordId = {
  ...baseOrderInclude,
  people: {
    ...baseOrderInclude.people,
    include: {
      ...baseOrderInclude.people.include,
      user: { select: { displayName: true, discordId: true } },
    },
  },
}
