'use client'

import { SkeletonCard, SkeletonTitle } from '~/features/ui/components/Skeleton'

export default function Loading() {
  return (
    <div>
      <SkeletonTitle />
      <SkeletonCard lines={2} />
      <SkeletonCard lines={2} />
      <SkeletonCard lines={2} />
      <SkeletonCard lines={3} />
    </div>
  )
}
