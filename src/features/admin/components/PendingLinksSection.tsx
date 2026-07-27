'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import styled from 'styled-components'
import { toast } from 'react-toastify'

import { Input } from '~/features/ui/components/Input'
import { Button } from '~/features/ui/components/Button'
import { Card, CardTitle } from '~/features/ui/components/Card'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import {
  useDismissPendingLink,
  usePendingDiscordLinks,
  useResolvePendingLinkCreateUser,
  useResolvePendingLinkToUser,
  useUsersWithoutDiscordLink,
} from '~/lib/queries/discordLinks'
import { useConfirm } from '~/features/ui/components/ConfirmDialog'
import {
  resolveDiscordLinkCreateUserSchema,
  type ResolveDiscordLinkCreateUserInput,
} from '~/lib/validations'
import { Actions, Empty, Meta, Select } from './DiscordLinkStyles'

const ErrorText = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  margin: 0;
`

const FormGroup = styled.form`
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

interface CreateUserSubFormProps {
  linkId: string
  defaultUsername: string
  defaultDisplayName: string
  onCancel: () => void
  onCreated: (linkId: string, tempPassword: string | null) => void
}

function CreateUserSubForm({
  linkId,
  defaultUsername,
  defaultDisplayName,
  onCancel,
  onCreated,
}: CreateUserSubFormProps) {
  const createMutation = useResolvePendingLinkCreateUser()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResolveDiscordLinkCreateUserInput>({
    resolver: zodResolver(resolveDiscordLinkCreateUserSchema),
    defaultValues: { username: defaultUsername, displayName: defaultDisplayName, role: 'USER' },
  })

  const onSubmit = async (data: ResolveDiscordLinkCreateUserInput) => {
    const result = await createMutation.mutateAsync({ linkId, data })
    if ('error' in result && result.error) {
      toast.error(result.error)
      return
    }
    toast.success('User created and linked')
    const password = 'tempPassword' in result ? result.tempPassword ?? null : null
    onCreated(linkId, password)
  }

  return (
    <FormGroup onSubmit={handleSubmit(onSubmit)}>
      <Input {...register('username')} placeholder="username" />
      {errors.username && <ErrorText>{errors.username.message}</ErrorText>}
      <Input {...register('displayName')} placeholder="Display name" />
      {errors.displayName && <ErrorText>{errors.displayName.message}</ErrorText>}
      <Select {...register('role')}>
        <option value="USER">User</option>
        <option value="ADMIN">Admin</option>
      </Select>
      <Actions>
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create & link'}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </Actions>
    </FormGroup>
  )
}

export function PendingLinksSection() {
  const linksQuery = usePendingDiscordLinks()
  const usersQuery = useUsersWithoutDiscordLink()
  const linkToUserMutation = useResolvePendingLinkToUser()
  const dismissMutation = useDismissPendingLink()
  const confirm = useConfirm()

  const links = linksQuery.data ?? []
  const users = usersQuery.data ?? []

  const [selectedUserByLink, setSelectedUserByLink] = useState<Record<string, string>>({})
  const [creatingForLink, setCreatingForLink] = useState<string | null>(null)
  const [tempPasswords, setTempPasswords] = useState<Record<string, string>>({})

  const handleLinkToExisting = async (linkId: string) => {
    const userId = selectedUserByLink[linkId]
    if (!userId) {
      toast.error('Pick a user')
      return
    }
    const result = await linkToUserMutation.mutateAsync({ linkId, userId })
    if ('error' in result && result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Linked')
  }

  const handleDismiss = async (linkId: string) => {
    if (!await confirm({ title: 'Dismiss without resolving?', variant: 'danger', confirmLabel: 'Dismiss' })) return
    await dismissMutation.mutateAsync(linkId)
    toast.success('Dismissed')
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
                onClick={() => setCreatingForLink(link.id)}
              >
                Create new user
              </Button>
              <Button variant="danger" size="sm" onClick={() => handleDismiss(link.id)}>
                Dismiss
              </Button>
            </Actions>

            {isCreating && (
              <CreateUserSubForm
                linkId={link.id}
                defaultUsername={link.discordUsername}
                defaultDisplayName={displayName}
                onCancel={() => setCreatingForLink(null)}
                onCreated={(id, password) => {
                  setCreatingForLink(null)
                  if (password) setTempPasswords(prev => ({ ...prev, [id]: password }))
                }}
              />
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
