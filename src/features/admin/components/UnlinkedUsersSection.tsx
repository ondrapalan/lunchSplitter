'use client'

import { useState } from 'react'
import styled from 'styled-components'
import { toast } from 'react-toastify'

import { Button } from '~/features/ui/components/Button'
import { Card, CardTitle } from '~/features/ui/components/Card'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import { useUnlinkedDiscordMembers, useUsersWithoutDiscordLink } from '~/lib/queries/discordLinks'
import { useSetUserDiscordId } from '~/lib/queries/users'
import { memberLabel, sortMembersForDisplay } from '~/lib/discordMemberDisplay'
import type { DiscordGuildMember } from '~/lib/discord'
import { Actions, Empty, Meta, Select } from './DiscordLinkStyles'

const Notice = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  margin: ${({ theme }) => theme.spacing.md} 0;
`

const Roster = styled.details`
  margin: ${({ theme }) => theme.spacing.lg} 0;

  summary {
    cursor: pointer;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.sm};
  }
`

const RosterRow = styled.div`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  padding: ${({ theme }) => theme.spacing.xs} 0;
`

function rosterText(members: DiscordGuildMember[]): string {
  return members
    .map(member => [
      member.nick ?? member.globalName ?? member.username,
      `@${member.username}`,
      member.discordId,
    ].join('\t'))
    .join('\n')
}

export function UnlinkedUsersSection() {
  const usersQuery = useUsersWithoutDiscordLink()
  const membersQuery = useUnlinkedDiscordMembers()
  const setDiscordId = useSetUserDiscordId()
  const [selectedByUser, setSelectedByUser] = useState<Record<string, string>>({})

  const users = usersQuery.data ?? []
  const memberResult = membersQuery.data
  const members = memberResult && 'members' in memberResult
    ? sortMembersForDisplay(memberResult.members)
    : []
  const error = memberResult && 'error' in memberResult ? memberResult.error : null

  const handleLink = async (userId: string) => {
    const discordId = selectedByUser[userId]
    if (!discordId) {
      toast.error('Pick a Discord member')
      return
    }
    const result = await setDiscordId.mutateAsync({ userId, discordId })
    if ('error' in result && result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Linked')
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(rosterText(members))
    toast.success('Copied to clipboard')
  }

  return (
    <div>
      <SectionTitle>Missing Discord link ({users.length})</SectionTitle>

      {error && <Notice>{error}</Notice>}

      {!error && users.length === 0 && <Empty>Everyone is linked. 🎉</Empty>}

      {!error && users.map(user => (
        <Card key={user.id} style={{ marginBottom: 16 }}>
          <CardTitle>
            {user.displayName}{' '}
            <span style={{ fontWeight: 400, fontSize: '0.85em', opacity: 0.7 }}>(@{user.username})</span>
          </CardTitle>
          <Actions>
            <Select
              value={selectedByUser[user.id] || ''}
              onChange={e => setSelectedByUser(prev => ({ ...prev, [user.id]: e.target.value }))}
            >
              <option value="">— pick a Discord member —</option>
              {members.map(member => (
                <option key={member.discordId} value={member.discordId}>{memberLabel(member)}</option>
              ))}
            </Select>
            <Button variant="primary" size="sm" onClick={() => handleLink(user.id)}>
              Link
            </Button>
          </Actions>
        </Card>
      ))}

      {!error && members.length > 0 && (
        <Roster>
          <summary>On Discord, not linked yet ({members.length})</summary>
          {members.map(member => (
            <RosterRow key={member.discordId}>
              {memberLabel(member)} · <code>{member.discordId}</code>
            </RosterRow>
          ))}
          <Meta>
            <Button variant="secondary" size="sm" onClick={handleCopy}>Copy as text</Button>
          </Meta>
        </Roster>
      )}
    </div>
  )
}
