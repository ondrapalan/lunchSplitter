'use client'

import { SkeletonTable, SkeletonTitle } from '~/features/ui/components/Skeleton'

export default function Loading() {
  return (
    <div>
      <SkeletonTitle />
      <SkeletonTable rows={6} />
    </div>
  )
}
