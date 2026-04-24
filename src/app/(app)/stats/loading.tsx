'use client'

import { SkeletonCard, SkeletonTitle } from '~/features/ui/components/Skeleton'

export default function Loading() {
  return (
    <div>
      <SkeletonTitle />
      <SkeletonCard lines={4} />
      <SkeletonCard lines={5} />
      <SkeletonCard lines={4} />
      <SkeletonCard lines={5} />
    </div>
  )
}
