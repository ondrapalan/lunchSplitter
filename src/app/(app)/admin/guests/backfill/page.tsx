'use client'

import { useState } from 'react'
import styled from 'styled-components'
import Link from 'next/link'
import { toast } from 'react-toastify'
import { Button } from '~/features/ui/components/Button'
import { Card, CardTitle } from '~/features/ui/components/Card'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import {
  useBackfillLegacyGuest,
  useCreateGuest,
  useGuests,
  useLegacyGuestNames,
} from '~/lib/queries/guests'
import { useRegisteredUsers } from '~/lib/queries/users'

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: center;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`

const Meta = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`

const Select = styled.select`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.text};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`

const NEW_GUEST = '__new__'

export default function GuestBackfillPage() {
  const [selections, setSelections] = useState<Record<string, { guestId: string; hostId: string }>>({})

  const legacyQuery = useLegacyGuestNames()
  const guestsQuery = useGuests()
  const usersQuery = useRegisteredUsers()
  const createGuestMutation = useCreateGuest()
  const backfillMutation = useBackfillLegacyGuest()

  const legacy = legacyQuery.data ?? []
  const guests = guestsQuery.data ?? []
  const users = usersQuery.data ?? []
  const loading = legacyQuery.isPending || guestsQuery.isPending || usersQuery.isPending

  const handleSelection = (name: string, field: 'guestId' | 'hostId', value: string) => {
    setSelections(prev => ({
      ...prev,
      [name]: { guestId: prev[name]?.guestId ?? '', hostId: prev[name]?.hostId ?? '', [field]: value },
    }))
  }

  const handleApply = async (name: string) => {
    const sel = selections[name]
    if (!sel?.guestId || !sel.hostId) {
      toast.error('Pick a guest and a host first')
      return
    }
    try {
      let guestId = sel.guestId
      if (guestId === NEW_GUEST) {
        const created = await createGuestMutation.mutateAsync({ name, defaultHostUserId: sel.hostId })
        guestId = created.id
      }
      const result = await backfillMutation.mutateAsync({ legacyName: name, guestId, hostUserId: sel.hostId })
      toast.success(`Updated ${result.updated} rows for "${name}"`)
      setSelections(prev => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Backfill failed')
    }
  }

  return (
    <div>
      <SectionTitle>Guest Backfill</SectionTitle>
      <Link href="/admin/guests">← Back to guests</Link>

      <Card style={{ marginTop: 16 }}>
        <CardTitle>Legacy free-text guests</CardTitle>
        <Meta>
          Rows below are old OrderPerson entries without a linked user or guest record. Map each name
          to an existing or new Guest, then pick which user hosted them. Stats will update when you apply.
        </Meta>
      </Card>

      <div style={{ marginTop: 16 }}>
        {loading && <Meta>Loading…</Meta>}
        {!loading && legacy.length === 0 && <Meta>No legacy free-text guests. Nothing to backfill. 🎉</Meta>}
        {legacy.map(row => {
          const sel = selections[row.name] ?? { guestId: '', hostId: '' }
          return (
            <Row key={row.name}>
              <div style={{ minWidth: 160 }}>
                <strong>{row.name}</strong>
                <Meta> · {row.count} order{row.count === 1 ? '' : 's'}</Meta>
              </div>
              <label>
                <Meta>Guest:</Meta>{' '}
                <Select
                  value={sel.guestId}
                  onChange={e => handleSelection(row.name, 'guestId', e.target.value)}
                >
                  <option value="">— pick —</option>
                  <option value={NEW_GUEST}>+ create new guest "{row.name}"</option>
                  {guests.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </Select>
              </label>
              <label>
                <Meta>Host:</Meta>{' '}
                <Select
                  value={sel.hostId}
                  onChange={e => handleSelection(row.name, 'hostId', e.target.value)}
                >
                  <option value="">— pick —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.displayName}</option>
                  ))}
                </Select>
              </label>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleApply(row.name)}
                disabled={!sel.guestId || !sel.hostId}
              >
                Apply
              </Button>
            </Row>
          )
        })}
      </div>
    </div>
  )
}
