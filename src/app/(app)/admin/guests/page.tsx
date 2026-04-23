'use client'

import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { toast } from 'react-toastify'
import Link from 'next/link'
import { listGuestsWithStats, createGuest, updateGuest, deleteGuest } from '~/actions/guests'
import { getRegisteredUsers } from '~/actions/users'
import { Input } from '~/features/ui/components/Input'
import { Button } from '~/features/ui/components/Button'
import { Card, CardTitle } from '~/features/ui/components/Card'
import { SectionTitle } from '~/features/ui/components/SectionTitle'

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

interface GuestRow {
  id: string
  name: string
  aliases: string[]
  defaultHostUserId: string
  defaultHostDisplayName: string
  visitCount: number
  lastVisit: string | null
}

interface UserOption {
  id: string
  displayName: string
}

export default function AdminGuestsPage() {
  const [guests, setGuests] = useState<GuestRow[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [newName, setNewName] = useState('')
  const [newHostId, setNewHostId] = useState('')
  const [creating, setCreating] = useState(false)

  const reload = async () => {
    try {
      const [g, u] = await Promise.all([listGuestsWithStats(), getRegisteredUsers()])
      setGuests(g)
      setUsers(u.map(x => ({ id: x.id, displayName: x.displayName })))
      if (!newHostId && u.length > 0) setNewHostId(u[0].id)
    } catch {
      toast.error('Failed to load guests')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !newHostId) return
    setCreating(true)
    try {
      await createGuest({ name: newName.trim(), defaultHostUserId: newHostId })
      toast.success('Guest created')
      setNewName('')
      await reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create guest')
    } finally {
      setCreating(false)
    }
  }

  const handleChangeHost = async (id: string, defaultHostUserId: string) => {
    try {
      await updateGuest(id, { defaultHostUserId })
      setGuests(prev => prev.map(g => g.id === id ? {
        ...g,
        defaultHostUserId,
        defaultHostDisplayName: users.find(u => u.id === defaultHostUserId)?.displayName ?? g.defaultHostDisplayName,
      } : g))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update host')
    }
  }

  const handleRename = async (id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      await updateGuest(id, { name: trimmed })
      setGuests(prev => prev.map(g => g.id === id ? { ...g, name: trimmed } : g))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to rename')
    }
  }

  const handleAddAlias = async (id: string, alias: string) => {
    const trimmed = alias.trim()
    if (!trimmed) return
    const guest = guests.find(g => g.id === id)
    if (!guest) return
    const newAliases = [...guest.aliases, trimmed]
    try {
      await updateGuest(id, { aliases: newAliases })
      setGuests(prev => prev.map(g => g.id === id ? { ...g, aliases: newAliases } : g))
    } catch {
      toast.error('Failed to add alias')
    }
  }

  const handleRemoveAlias = async (id: string, index: number) => {
    const guest = guests.find(g => g.id === id)
    if (!guest) return
    const newAliases = guest.aliases.filter((_, i) => i !== index)
    try {
      await updateGuest(id, { aliases: newAliases })
      setGuests(prev => prev.map(g => g.id === id ? { ...g, aliases: newAliases } : g))
    } catch {
      toast.error('Failed to remove alias')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete guest "${name}"?`)) return
    try {
      await deleteGuest(id)
      toast.success('Guest deleted')
      await reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <div>
      <SectionTitle>Guests</SectionTitle>

      <Card>
        <CardTitle>Create Guest</CardTitle>
        <Form onSubmit={handleCreate}>
          <Field>
            <Label>Name</Label>
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Guest name" />
          </Field>
          <Field>
            <Label>Default host</Label>
            <Select value={newHostId} onChange={e => setNewHostId(e.target.value)}>
              {users.length === 0 && <option value="">No users</option>}
              {users.map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}
            </Select>
          </Field>
          <Button type="submit" variant="primary" disabled={creating || !newName.trim() || !newHostId}>
            {creating ? 'Creating...' : 'Create Guest'}
          </Button>
        </Form>
      </Card>

      <div style={{ marginTop: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Link href="/admin/guests/backfill">Backfill legacy free-text guests →</Link>
        <Link href="/admin/items">Packaging / item backfill →</Link>
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
