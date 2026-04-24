'use client'

import styled, { keyframes } from 'styled-components'

const pulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
`

export const Skeleton = styled.div<{ $width?: string; $height?: string; $radius?: 'sm' | 'md' | 'lg' }>`
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme, $radius = 'md' }) => theme.borderRadius[$radius]};
  animation: ${pulse} 1.5s ease-in-out infinite;
  width: ${({ $width }) => $width ?? '100%'};
  height: ${({ $height }) => $height ?? '16px'};
`

const TextStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`

export function SkeletonText({ lines = 3, lastWidth = '60%' }: { lines?: number; lastWidth?: string }) {
  return (
    <TextStack>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} $height="14px" $width={i === lines - 1 ? lastWidth : '100%'} />
      ))}
    </TextStack>
  )
}

const CardShell = styled.div`
  background: ${({ theme }) => theme.colors.cardBackground};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`

export function SkeletonCard({ lines = 3, showTitle = true }: { lines?: number; showTitle?: boolean }) {
  return (
    <CardShell>
      {showTitle && <Skeleton $height="20px" $width="40%" />}
      <SkeletonText lines={lines} />
    </CardShell>
  )
}

const TableWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`

export function SkeletonTable({ rows = 5, showHeader = true }: { rows?: number; showHeader?: boolean }) {
  return (
    <TableWrap>
      {showHeader && <Skeleton $height="18px" $width="30%" />}
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} $height="32px" />
      ))}
    </TableWrap>
  )
}

export const SkeletonTitle = styled(Skeleton).attrs({ $height: '28px', $width: '200px' })`
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`
