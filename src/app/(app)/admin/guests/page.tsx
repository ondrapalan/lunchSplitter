'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import styled from 'styled-components'
import { toast } from 'react-toastify'
import Link from 'next/link'
import { Input } from '~/features/ui/components/Input'
import { Button } from '~/features/ui/components/Button'
import { Card, CardTitle } from '~/features/ui/components/Card'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import {
  useCreateGuest,
  useDeleteGuest,
  useGuestsWithStats,
  useUpdateGuest,
} from '~/lib/queries/guests'
import { useRegisteredUsers } from '~/lib/queries/users'
import { createGuestSchema, type CreateGuestInput } from '~/lib/validations'
import { useConfirm } from '~/features/ui/components/ConfirmDialog'

const Form = styled.form`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.md};
  align-items: flex-end;
`

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 180px;
  flex: 1;
`

const Label = styled.label`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.xs};
`

const ErrorText = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  margin: 0;
`

const Select = styled.select`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.text};
  padding: ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.fontSizes.md};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.md};
`

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: center;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
`

const Name = styled.span`
  font-weight: 500;
`

const Meta = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`

const Spacer = styled.div`
  flex: 1;
`

const AliasRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  margin-top: ${({ theme }) => theme.spacing.xs};
`

const AliasTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: ${({ theme }) => theme.colors.surfaceLight};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  padding: 2px ${({ theme }) => theme.spacing.xs};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
`

const RemoveAlias = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.textDim};
  cursor: pointer;
  padding: 0;
  font-size: ${({ theme }) => theme.fontSizes.xs};

  &:hover {
    color: ${({ theme }) => theme.colors.negative};
  }
`

const AliasInput = styled.input`
  background: transparent;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.text};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  padding: 2px ${({ theme }) => theme.spacing.xs};
  width: 110px;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`

export default function AdminGuestsPage() {
  const guestsQuery = useGuestsWithStats()
  const usersQuery = useRegisteredUsers()
  const createMutation = useCreateGuest()
  const updateMutation = useUpdateGuest()
  const deleteMutation = useDeleteGuest()
  const confirm = useConfirm()

  const guests = guestsQuery.data ?? []
  const users = (usersQuery.data ?? []).map(u => ({ id: u.id, displayName: u.displayName }))

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateGuestInput>({
    resolver: zodResolver(createGuestSchema),
    defaultValues: { name: '', defaultHostUserId: '' },
  })

  // Pre-select the first user as default host once users load.
  useEffect(() => {
    if (users.length > 0) {
      setValue('defaultHostUserId', users[0].id, { shouldDirty: false, shouldValidate: false })
    }
  }, [users, setValue])

  const onCreate = async (data: CreateGuestInput) => {
    try {
      await createMutation.mutateAsync({
        name: data.name.trim(),
        defaultHostUserId: data.defaultHostUserId,
      })
      toast.success('Guest created')
      reset({ name: '', defaultHostUserId: data.defaultHostUserId })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create guest')
    }
  }

  const handleChangeHost = async (id: string, defaultHostUserId: string) => {
    try {
      await updateMutation.mutateAsync({ id, patch: { defaultHostUserId } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update host')
    }
  }

  const handleRename = async (id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      await updateMutation.mutateAsync({ id, patch: { name: trimmed } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to rename')
    }
  }

  const handleAddAlias = async (id: string, alias: string) => {
    const trimmed = alias.trim()
    if (!trimmed) return
    const guest = guests.find(g => g.id === id)
    if (!guest) return
    try {
      await updateMutation.mutateAsync({ id, patch: { aliases: [...guest.aliases, trimmed] } })
    } catch {
      toast.error('Failed to add alias')
    }
  }

  const handleRemoveAlias = async (id: string, index: number) => {
    const guest = guests.find(g => g.id === id)
    if (!guest) return
    try {
      await updateMutation.mutateAsync({
        id,
        patch: { aliases: guest.aliases.filter((_, i) => i !== index) },
      })
    } catch {
      toast.error('Failed to remove alias')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!await confirm({ title: `Delete guest "${name}"?`, variant: 'danger', confirmLabel: 'Delete' })) return
    try {
      await deleteMutation.mutateAsync(id)
      toast.success('Guest deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <div>
      <SectionTitle>Guests</SectionTitle>

      <Card>
        <CardTitle>Create Guest</CardTitle>
        <Form onSubmit={handleSubmit(onCreate)}>
          <Field>
            <Label>Name</Label>
            <Input {...register('name')} placeholder="Guest name" />
            {errors.name && <ErrorText>{errors.name.message}</ErrorText>}
          </Field>
          <Field>
            <Label>Default host</Label>
            <Select {...register('defaultHostUserId')}>
              {users.length === 0 && <option value="">No users</option>}
              {users.map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}
            </Select>
            {errors.defaultHostUserId && <ErrorText>{errors.defaultHostUserId.message}</ErrorText>}
          </Field>
          <Button type="submit" variant="primary" disabled={isSubmitting || users.length === 0}>
            {isSubmitting ? 'Creating...' : 'Create Guest'}
          </Button>
        </Form>
      </Card>

      <div style={{ marginTop: 16 }}>
        <Link href="/admin/guests/backfill">Backfill legacy free-text guests →</Link>
      </div>

      <SectionTitle>Existing Guests</SectionTitle>
      <List>
        {guests.length === 0 && <Meta>No guests yet.</Meta>}
        {guests.map(g => (
          <Row key={g.id}>
            <div>
              <Name>
                <Input
                  defaultValue={g.name}
                  onBlur={e => { if (e.target.value !== g.name) handleRename(g.id, e.target.value) }}
                  style={{ maxWidth: 160 }}
                />
              </Name>
              <AliasRow>
                {g.aliases.map((a, i) => (
                  <AliasTag key={i}>
                    {a}
                    <RemoveAlias onClick={() => handleRemoveAlias(g.id, i)} title="Remove alias">&times;</RemoveAlias>
                  </AliasTag>
                ))}
                <AliasInput
                  placeholder="+ alias"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleAddAlias(g.id, e.currentTarget.value)
                      e.currentTarget.value = ''
                    }
                  }}
                />
              </AliasRow>
            </div>
            <Field style={{ maxWidth: 200 }}>
              <Label>Default host</Label>
              <Select value={g.defaultHostUserId} onChange={e => handleChangeHost(g.id, e.target.value)}>
                {users.map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}
              </Select>
            </Field>
            <Meta>
              {g.visitCount} visit{g.visitCount === 1 ? '' : 's'}
              {g.lastVisit && ` · last ${new Date(g.lastVisit).toLocaleDateString()}`}
            </Meta>
            <Spacer />
            <Button variant="danger" size="sm" onClick={() => handleDelete(g.id, g.name)}>
              Delete
            </Button>
          </Row>
        ))}
      </List>
    </div>
  )
}
