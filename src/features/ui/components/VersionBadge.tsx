'use client'

import styled from 'styled-components'

const Badge = styled.div`
  position: fixed;
  bottom: ${({ theme }) => theme.spacing.xs};
  left: ${({ theme }) => theme.spacing.sm};
  z-index: 50;
  pointer-events: none;
  color: ${({ theme }) => theme.colors.textDim};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  opacity: 0.6;
  user-select: none;
`

export function VersionBadge() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION
  if (!version) return null
  return <Badge title={`Lunch Splitter v${version}`}>v{version}</Badge>
}
