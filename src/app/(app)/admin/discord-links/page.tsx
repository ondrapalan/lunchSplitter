'use client'

import { PendingLinksSection } from '~/features/admin/components/PendingLinksSection'
import { UnlinkedUsersSection } from '~/features/admin/components/UnlinkedUsersSection'

export default function AdminDiscordLinksPage() {
  return (
    <div>
      <UnlinkedUsersSection />
      <PendingLinksSection />
    </div>
  )
}
