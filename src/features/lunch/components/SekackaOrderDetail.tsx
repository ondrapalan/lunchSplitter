'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import styled from 'styled-components'
import { toast } from 'react-toastify'

import { Button } from '~/features/ui/components/Button'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import { StatusBadge } from '~/features/ui/components/StatusBadge'
import { Card, CardTitle } from '~/features/ui/components/Card'
import { closeOrder, reopenOrder, deleteOrder } from '~/actions/orders'
import {
  publishSekackaToDiscord,
  addSekackaParticipantByUserId,
  removeSekackaParticipantByUserId,
  getSekackaActivityLog,
  listAppUsersForSekackaPicker,
} from '~/actions/sekacka'
import { getPaymentConfirmations, togglePaymentConfirmation } from '~/actions/discord'
import { OrderActivityTimeline, type ActivityLogEntry } from './OrderActivityTimeline'
import type { LunchSession } from '~/features/lunch/types'
import { useConfirm } from '~/features/ui/components/ConfirmDialog'

interface SekackaAccess {
  isCreator: boolean
  isAdminView: boolean
  canEdit: boolean
  canClose: boolean
  canReopen: boolean
  canDelete: boolean
}

interface Props {
  orderId: string
  creatorName: string
  session: LunchSession
  status: 'OPEN' | 'CLOSED'
  createdById: string
  discordAnnounceMessageId: string | null
  access: SekackaAccess
  onReload: () => void
}

const HeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`

const Actions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
`

const ItemLine = styled.div`
  display: flex;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.xs} 0;
  border-bottom: 1px dashed ${({ theme }) => theme.colors.border};
`

const TotalLine = styled.div`
  display: flex;
  justify-content: space-between;
  padding-top: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.sm};
  border-top: 2px solid ${({ theme }) => theme.colors.border};
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: 600;
`

const ParticipantRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.sm};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  &:last-child { border-bottom: none; }
`

const ParticipantMeta = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  margin-left: ${({ theme }) => theme.spacing.sm};
`

const PickerRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: center;
  padding: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.sm};
`

const Select = styled.select`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.text};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  flex: 1;
`

const PaymentPill = styled.button<{ $confirmed: boolean }>`
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  border: 1px solid ${({ theme, $confirmed }) => $confirmed ? theme.colors.positive : theme.colors.border};
  background: ${({ theme, $confirmed }) => $confirmed ? theme.colors.positive : 'transparent'};
  color: ${({ theme, $confirmed }) => $confirmed ? theme.colors.background : theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  cursor: pointer;
`

interface PickerUser {
  id: string
  displayName: string
  username: string
  discordId: string | null
}

function formatKc(amount: number): string {
  return `${amount.toFixed(2)} Kč`
}

export function SekackaOrderDetail({
  orderId,
  creatorName,
  session,
  status,
  createdById,
  discordAnnounceMessageId,
  access,
  onReload,
}: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [pickerUsers, setPickerUsers] = useState<PickerUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [activity, setActivity] = useState<ActivityLogEntry[]>([])
  const [paymentConfirmations, setPaymentConfirmations] = useState<Record<string, { confirmed: boolean; confirmedAt: string | null }>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const loadPickerUsers = useCallback(async () => {
    if (!access.isCreator && !access.isAdminView) return
    try {
      const list = await listAppUsersForSekackaPicker(orderId)
      setPickerUsers(list)
    } catch { /* silent */ }
  }, [orderId, access.isCreator, access.isAdminView])

  const loadActivity = useCallback(async () => {
    try {
      const log = await getSekackaActivityLog(orderId)
      setActivity(log as ActivityLogEntry[])
    } catch { /* silent */ }
  }, [orderId])

  useEffect(() => {
    loadPickerUsers()
    loadActivity()
  }, [loadPickerUsers, loadActivity])

  useEffect(() => {
    if (status !== 'CLOSED') return
    const refresh = () => {
      getPaymentConfirmations(orderId).then(setPaymentConfirmations).catch(() => {})
    }
    refresh()
    const interval = setInterval(refresh, 30_000)
    return () => clearInterval(interval)
  }, [status, orderId])

  const creatorPerson = session.people.find(p => p.userId === createdById)
  const items = creatorPerson?.items ?? []
  const total = items.reduce((sum, i) => sum + i.price, 0)
  const perPerson = session.people.length > 0 ? total / session.people.length : 0

  const handlePublish = async () => {
    setBusy('publish')
    try {
      const result = await publishSekackaToDiscord(orderId)
      if (!result.success) {
        toast.error(result.error || 'Failed to publish')
        return
      }
      toast.success('Published to Discord 🚀')
      onReload()
      loadActivity()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish')
    } finally {
      setBusy(null)
    }
  }

  const handleAddParticipant = async () => {
    if (!selectedUserId) return
    setBusy('add')
    try {
      await addSekackaParticipantByUserId(orderId, selectedUserId)
      toast.success('Added')
      setSelectedUserId('')
      onReload()
      loadPickerUsers()
      loadActivity()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add')
    } finally {
      setBusy(null)
    }
  }

  const handleRemoveParticipant = async (userId: string) => {
    if (!await confirm({ title: 'Remove this participant?', variant: 'danger', confirmLabel: 'Remove' })) return
    setBusy(`remove-${userId}`)
    try {
      await removeSekackaParticipantByUserId(orderId, userId)
      toast.success('Removed')
      onReload()
      loadPickerUsers()
      loadActivity()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove')
    } finally {
      setBusy(null)
    }
  }

  const handleClose = async () => {
    if (!await confirm({ title: 'Close Sekačka and send QR codes?', confirmLabel: 'Close & send' })) return
    setBusy('close')
    try {
      const result = await closeOrder(orderId, { sendDiscord: true })
      toast.success('Sekačka closed')
      if (result.discord) {
        const { sent, skipped, failed } = result.discord
        if (sent.length > 0) toast.info(`QR sent to: ${sent.join(', ')}`)
        if (skipped.length > 0) toast.warn(`No Discord linked: ${skipped.join(', ')}`)
        if (failed.length > 0) toast.error(`Failed for: ${failed.join(', ')}`)
      }
      onReload()
      loadActivity()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to close')
    } finally {
      setBusy(null)
    }
  }

  const handleReopen = async () => {
    if (!await confirm({ title: 'Reopen Sekačka?', confirmLabel: 'Reopen' })) return
    setBusy('reopen')
    try {
      await reopenOrder(orderId)
      toast.success('Reopened')
      onReload()
      loadActivity()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reopen')
    } finally {
      setBusy(null)
    }
  }

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete this Sekačka?',
      message: 'This cannot be undone.',
      variant: 'danger',
      confirmLabel: 'Delete',
    })
    if (!ok) return
    setBusy('delete')
    try {
      await deleteOrder(orderId)
      toast.success('Deleted')
      router.push('/orders')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setBusy(null)
    }
  }

  const handleTogglePayment = async (personId: string) => {
    try {
      const { confirmed } = await togglePaymentConfirmation(personId)
      setPaymentConfirmations(prev => ({
        ...prev,
        [personId]: { confirmed, confirmedAt: confirmed ? new Date().toISOString() : null },
      }))
    } catch {
      toast.error('Failed to update payment status')
    }
  }

  return (
    <div>
      <HeaderRow>
        <SectionTitle style={{ marginBottom: 0 }}>
          🥩 Sekačka by {creatorName}
          <StatusBadge $status={status} style={{ marginLeft: 8 }}>
            {status === 'OPEN' ? 'Open' : 'Closed'}
          </StatusBadge>
        </SectionTitle>
        <Actions>
          {status === 'OPEN' && !discordAnnounceMessageId && access.canEdit && (
            <Button variant="primary" onClick={handlePublish} loading={busy === 'publish'}>
              📣 Publish to Discord
            </Button>
          )}
          {status === 'OPEN' && access.canClose && (
            <Button variant="primary" onClick={handleClose} loading={busy === 'close'}>
              Close & send QR
            </Button>
          )}
          {status === 'CLOSED' && access.canReopen && (
            <Button variant="secondary" onClick={handleReopen} loading={busy === 'reopen'}>
              Reopen
            </Button>
          )}
          {access.canDelete && (
            <Button variant="danger" onClick={handleDelete} loading={busy === 'delete'}>
              Delete
            </Button>
          )}
        </Actions>
      </HeaderRow>

      <Card>
        <CardTitle>Items</CardTitle>
        {items.length === 0 ? (
          <p>No items yet.</p>
        ) : (
          <>
            {items.map(item => (
              <ItemLine key={item.id}>
                <span>{item.name}</span>
                <span>{formatKc(item.price)}</span>
              </ItemLine>
            ))}
            <TotalLine>
              <span>Total</span>
              <span>{formatKc(total)}</span>
            </TotalLine>
            <TotalLine>
              <span>{session.people.length} participant(s) × {formatKc(perPerson)}</span>
              <span>{formatKc(total)}</span>
            </TotalLine>
          </>
        )}
      </Card>

      <Card style={{ marginTop: 16 }}>
        <CardTitle>Participants</CardTitle>
        {session.people.map(person => {
          const isCreatorPerson = person.userId === createdById
          const paid = paymentConfirmations[person.id]?.confirmed
          return (
            <ParticipantRow key={person.id}>
              <div>
                <strong>{person.name}</strong>
                {isCreatorPerson && <ParticipantMeta>creator</ParticipantMeta>}
                <ParticipantMeta>{formatKc(perPerson)}</ParticipantMeta>
              </div>
              <Actions>
                {status === 'CLOSED' && !isCreatorPerson && (access.isCreator || access.isAdminView) && (
                  <PaymentPill
                    $confirmed={!!paid}
                    onClick={() => handleTogglePayment(person.id)}
                    title={paid ? 'Paid (click to un-confirm)' : 'Unpaid (click to confirm)'}
                  >
                    {paid ? '✓ paid' : 'unpaid'}
                  </PaymentPill>
                )}
                {status === 'OPEN' && !isCreatorPerson && access.canEdit && person.userId && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => person.userId && handleRemoveParticipant(person.userId)}
                    loading={busy === `remove-${person.userId}`}
                  >
                    Remove
                  </Button>
                )}
              </Actions>
            </ParticipantRow>
          )
        })}

        {status === 'OPEN' && access.canEdit && (
          <PickerRow>
            <Select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
              <option value="">— add participant —</option>
              {pickerUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.displayName} {u.discordId ? '' : '(no Discord)'}
                </option>
              ))}
            </Select>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddParticipant}
              disabled={!selectedUserId}
              loading={busy === 'add'}
            >
              Add
            </Button>
          </PickerRow>
        )}
      </Card>

      <Card style={{ marginTop: 16 }}>
        <CardTitle>Activity</CardTitle>
        <OrderActivityTimeline entries={activity} />
      </Card>
    </div>
  )
}
