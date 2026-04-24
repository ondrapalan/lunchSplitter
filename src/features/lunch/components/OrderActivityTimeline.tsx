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
    case 'CREATED': return `📝 ${actor} založil Sekačku`
    case 'PUBLISHED_TO_DISCORD': return `📣 ${actor} vypublikoval na Discord`
    case 'JOINED': return `🍞 ${target} se přihlásil`
    case 'LEFT': return `🚪 ${target} se odhlásil`
    case 'MANUAL_ADDED': return `➕ ${actor} přidal ${target}`
    case 'MANUAL_REMOVED': return `➖ ${actor} odebral ${target}`
    case 'PENDING_LINK_CREATED': return `⚠ Nepropojený Discord: ${entry.note ?? target}`
    case 'CLOSED': return `✅ ${actor} uzavřel Sekačku`
    case 'REOPENED': return `🔓 ${actor} znovu otevřel`
    case 'ITEM_ADDED': return `🧺 ${actor} přidal položku ${entry.note ?? ''}`
    case 'ITEM_EDITED': return `✏️ ${actor} upravil položku ${entry.note ?? ''}`
    case 'ITEM_REMOVED': return `🗑 ${actor} odebral položku ${entry.note ?? ''}`
    default: return `• ${entry.action}`
  }
}

export function OrderActivityTimeline({ entries }: Props) {
  if (entries.length === 0) {
    return <Empty>Žádná aktivita.</Empty>
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
