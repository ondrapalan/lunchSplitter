'use client'

import styled from 'styled-components'

export interface ActivityLogEntry {
  id: string
  action: string
  source: 'DISCORD' | 'WEB' | 'ADMIN'
  actorName: string | null
  targetName: string | null
  note: string | null
  createdAt: string
}

interface Props {
  entries: ActivityLogEntry[]
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  margin-top: ${({ theme }) => theme.spacing.md};
`

const Row = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.text};
  border-left: 2px solid ${({ theme }) => theme.colors.border};
`

const Time = styled.span`
  color: ${({ theme }) => theme.colors.textDim};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  min-width: 60px;
`

const SourceTag = styled.span<{ $source: Props['entries'][number]['source'] }>`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  padding: 1px 6px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.textMuted};
  background: ${({ theme }) => theme.colors.surfaceLight};
`

const Empty = styled.div`
  color: ${({ theme }) => theme.colors.textDim};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  padding: ${({ theme }) => theme.spacing.sm};
`

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
}

function renderEntry(entry: ActivityLogEntry): string {
  const target = entry.targetName ?? entry.note ?? '?'
  const actor = entry.actorName ?? 'System'
  switch (entry.action) {
    case 'CREATED': return `📝 ${actor} created the Sekačka`
    case 'PUBLISHED_TO_DISCORD': return `📣 ${actor} published to Discord`
    case 'JOINED': return `🍞 ${target} joined`
    case 'LEFT': return `🚪 ${target} left`
    case 'MANUAL_ADDED': return `➕ ${actor} added ${target}`
    case 'MANUAL_REMOVED': return `➖ ${actor} removed ${target}`
    case 'PENDING_LINK_CREATED': return `⚠ Unlinked Discord: ${entry.note ?? target}`
    case 'CLOSED': return `✅ ${actor} closed the Sekačka`
    case 'REOPENED': return `🔓 ${actor} reopened`
    case 'ITEM_ADDED': return `🧺 ${actor} added item ${entry.note ?? ''}`
    case 'ITEM_EDITED': return `✏️ ${actor} edited item ${entry.note ?? ''}`
    case 'ITEM_REMOVED': return `🗑 ${actor} removed item ${entry.note ?? ''}`
    default: return `• ${entry.action}`
  }
}

export function OrderActivityTimeline({ entries }: Props) {
  if (entries.length === 0) {
    return <Empty>No activity.</Empty>
  }
  return (
    <Wrapper>
      {entries.map(entry => (
        <Row key={entry.id}>
          <Time>{formatTime(entry.createdAt)}</Time>
          <span>{renderEntry(entry)}</span>
          <SourceTag $source={entry.source}>{entry.source.toLowerCase()}</SourceTag>
        </Row>
      ))}
    </Wrapper>
  )
}
