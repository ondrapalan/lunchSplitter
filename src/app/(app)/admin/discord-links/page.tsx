'use client'

import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { toast } from 'react-toastify'

import { Input } from '~/features/ui/components/Input'
import { Button } from '~/features/ui/components/Button'
import { Card, CardTitle } from '~/features/ui/components/Card'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import {
  listPendingDiscordLinks,
  resolvePendingDiscordLinkToUser,
  resolvePendingDiscordLinkCreateUser,
  dismissPendingDiscordLink,
  getUsersWithoutDiscordLink,
} from '~/actions/pendingDiscordLinks'

interface PendingLink {
  id: string
  discordId: string
  discordUsername: string
  discordGlobalName: string | null
  discordNick: string | null
  createdAt: string
  triggeredByOrder: { id: string; status: string; type: string; creatorName: string } | null
}

interface PickableUser {
  id: string
  displayName: string
  username: string
}

const Meta = styled.div`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  margin-top: ${({ theme }) => theme.spacing.xs};
`

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.md};
`

const Select = styled.select`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.text};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  min-width: 200px;
`

const Empty = styled.p`
  color: ${({ theme }) => theme.colors.textDim};
  margin: ${({ theme }) => theme.spacing.md} 0;
`

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.sm};
`

const TempPasswordBox = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.positive};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.sm};
`

export default function AdminDiscordLinksPage() {
  const [links, setLinks] = useState<PendingLink[]>([])
  const [users, setUsers] = useState<PickableUser[]>([])
  const [selectedUserByLink, setSelectedUserByLink] = useState<Record<string, string>>({})
  const [creatingForLink, setCreatingForLink] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState<{ username: string; displayName: string; role: 'ADMIN' | 'USER' }>({
    username: '',
    displayName: '',
    role: 'USER',
  })
  const [tempPasswords, setTempPasswords] = useState<Record<string, string>>({})

  const load = async () => {
    try {
      const [ls, us] = await Promise.all([listPendingDiscordLinks(), getUsersWithoutDiscordLink()])
      setLinks(ls)
      setUsers(us)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load pending links')
    }
  }

  useEffect(() => { load() }, [])

  const handleLinkToExisting = async (linkId: string) => {
    const userId = selectedUserByLink[linkId]
    if (!userId) {
      toast.error('Pick a user')
      return
    }
    const result = await resolvePendingDiscordLinkToUser(linkId, userId)
    if ('error' in result && result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Linked')
    load()
  }

  const handleCreateUser = async (linkId: string) => {
    if (!createForm.username.trim() || !createForm.displayName.trim()) {
      toast.error('Fill in username and display name')
      return
    }
    const result = await resolvePendingDiscordLinkCreateUser(linkId, createForm)
    if ('error' in result && result.error) {
      toast.error(result.error)
      return
    }
    if ('tempPassword' in result && result.tempPassword) {
      setTempPasswords(prev => ({ ...prev, [linkId]: result.tempPassword }))
    }
    toast.success('User created and linked')
    setCreatingForLink(null)
    setCreateForm({ username: '', displayName: '', role: 'USER' })
    load()
  }

  const handleDismiss = async (linkId: string) => {
    if (!confirm('Dismiss without resolving?')) return
    await dismissPendingDiscordLink(linkId)
    toast.success('Dismissed')
    load()
  }

  return (
    <div>
      <SectionTitle>Unlinked Discord accounts</SectionTitle>

      {links.length === 0 && <Empty>Nothing to resolve — all clean. 🎉</Empty>}

      {links.map(link => {
        const displayName = link.discordNick || link.discordGlobalName || link.discordUsername
        const tempPassword = tempPasswords[link.id]
        const isCreating = creatingForLink === link.id
        return (
          <Card key={link.id} style={{ marginBottom: 16 }}>
            <CardTitle>
              {displayName} <span style={{ fontWeight: 400, fontSize: '0.85em', opacity: 0.7 }}>(@{link.discordUsername})</span>
            </CardTitle>
            <Meta>
              Discord ID: <code>{link.discordId}</code><br />
              Clicked {new Date(link.createdAt).toLocaleString('cs-CZ')}
              {link.triggeredByOrder && (
                <>
                  {' '}on <a href={`/orders/${link.triggeredByOrder.id}`}>Sekačka by {link.triggeredByOrder.creatorName}</a>
                </>
              )}
            </Meta>

            <Actions>
              <Select
                value={selectedUserByLink[link.id] || ''}
                onChange={e => setSelectedUserByLink(prev => ({ ...prev, [link.id]: e.target.value }))}
              >
                <option value="">— pick an existing user —</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.displayName} (@{u.username})</option>
                ))}
              </Select>
              <Button variant="primary" size="sm" onClick={() => handleLinkToExisting(link.id)}>
                Link
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setCreatingForLink(link.id)
                  setCreateForm({
                    username: link.discordUsername,
                    displayName: displayName,
                    role: 'USER',
                  })
                }}
              >
                Create new user
              </Button>
              <Button variant="danger" size="sm" onClick={() => handleDismiss(link.id)}>
                Dismiss
              </Button>
            </Actions>

            {isCreating && (
              <FormGroup>
                <Input
                  value={createForm.username}
                  onChange={e => setCreateForm(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="username"
                />
                <Input
                  value={createForm.displayName}
                  onChange={e => setCreateForm(prev => ({ ...prev, displayName: e.target.value }))}
                  placeholder="Display name"
                />
                <Select
                  value={createForm.role}
                  onChange={e => setCreateForm(prev => ({ ...prev, role: e.target.value as 'ADMIN' | 'USER' }))}
                >
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                </Select>
                <Actions>
                  <Button variant="primary" size="sm" onClick={() => handleCreateUser(link.id)}>
                    Create & link
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setCreatingForLink(null)}>
                    Cancel
                  </Button>
                </Actions>
              </FormGroup>
            )}

            {tempPassword && (
              <TempPasswordBox>
                Temporary password: <code>{tempPassword}</code>
              </TempPasswordBox>
            )}
          </Card>
        )
      })}
    </div>
  )
}
