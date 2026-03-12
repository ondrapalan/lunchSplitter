'use client'

import styled, { keyframes } from 'styled-components'

const pulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
`

const Skeleton = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  animation: ${pulse} 1.5s ease-in-out infinite;
`

const TitleSkeleton = styled(Skeleton)`
  height: 28px;
  width: 180px;
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`

const RowSkeleton = styled(Skeleton)`
  height: 60px;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`

export default function Loading() {
  return (
    <div>
      <TitleSkeleton />
      <RowSkeleton />
      <RowSkeleton />
      <RowSkeleton />
    </div>
  )
}
