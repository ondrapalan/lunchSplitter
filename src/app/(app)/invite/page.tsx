'use client'

import { useState, useEffect } from 'react'
import styled from 'styled-components'
import { toast } from 'react-toastify'
import { createInvitation, getMyInvitations, deleteInvitation } from '~/actions/invitations'
import { Button } from '~/features/ui/components/Button'
import { Input } from '~/features/ui/components/Input'
import { Card, CardTitle } from '~/features/ui/components/Card'
import { SectionTitle } from '~/features/ui/components/SectionTitle'

const PageWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`

const LinkRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: center;
  margin-top: ${({ theme }) => theme.spacing.sm};
`

const ReadOnlyInput = styled(Input).attrs({ readOnly: true })`
  cursor: text;
`

const InvitationList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`

const InvitationRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
`

const InvitationInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const InvitationDate = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textMuted};
`

const InvitationRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`

const InvitationCode = styled.code`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textMuted};
  background: ${({ theme }) => theme.colors.surface};
  padding: 2px ${({ theme }) => theme.spacing.xs};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const IconButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.textMuted};
  transition: color 0.15s ease;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const DeleteIconButton = styled(IconButton)`
  &:hover {
    color: ${({ theme }) => theme.colors.negative};
  }
`

const StatusBadge = styled.span<{ $status: 'pending' | 'used' | 'expired' }>`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 500;
  padding: 2px ${({ theme }) => theme.spacing.xs};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ $status, theme }) =>
    $status === 'pending'
      ? theme.colors.warning
      : $status === 'used'
        ? theme.colors.positive
        : theme.colors.textMuted};
`

type InvitationData = {
  id: string
  token: string
  createdAt: string
  expiresAt: string
  usedAt: string | null
  usedByName: string | null
}

function getStatus(inv: InvitationData): 'pending' | 'used' | 'expired' {
  if (inv.usedAt) return 'used'
  if (new Date(inv.expiresAt) < new Date()) return 'expired'
  return 'pending'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  })
}

export default function InvitePage() {
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [invitations, setInvitations] = useState<InvitationData[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadInvitations = async () => {
    const result = await getMyInvitations()
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    if ('invitations' in result && result.invitations) {
      setInvitations(result.invitations)
    }
  }

  useEffect(() => {
    loadInvitations()
  }, [])

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const result = await createInvitation()
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      const link = `${window.location.origin}/invite/${result.token}`
      setGeneratedLink(link)
      toast.success('Invite link generated!')
      loadInvitations()
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = async () => {
    if (!generatedLink) return
    await navigator.clipboard.writeText(generatedLink)
    toast.success('Link copied to clipboard!')
  }

  const handleCopyToken = async (token: string) => {
    const link = `${window.location.origin}/invite/${token}`
    await navigator.clipboard.writeText(link)
    toast.success('Link copied to clipboard!')
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const result = await deleteInvitation(id)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Invitation deleted')
      loadInvitations()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <PageWrapper>
      <SectionTitle>Invite Colleague</SectionTitle>

      <Card>
        <CardTitle>Generate Invite Link</CardTitle>
        <Button
          variant="primary"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? 'Generating...' : 'Generate Invite Link'}
        </Button>
        {generatedLink && (
          <LinkRow>
            <ReadOnlyInput value={generatedLink} />
            <Button variant="secondary" size="sm" onClick={handleCopy}>
              Copy
            </Button>
          </LinkRow>
        )}
      </Card>

      {invitations.length > 0 && (
        <Card>
          <CardTitle>Your Invitations</CardTitle>
          <InvitationList>
            {invitations.map((inv) => {
              const status = getStatus(inv)
              return (
                <InvitationRow key={inv.id}>
                  <InvitationInfo>
                    <InvitationDate>
                      Created {formatDate(inv.createdAt)}
                    </InvitationDate>
                    {status === 'used' && inv.usedByName && (
                      <InvitationDate>
                        Used by {inv.usedByName}
                      </InvitationDate>
                    )}
                    {status === 'pending' && (
                      <InvitationCode title={inv.token}>
                        {inv.token}
                      </InvitationCode>
                    )}
                  </InvitationInfo>
                  <InvitationRight>
                    <StatusBadge $status={status}>
                      {status === 'pending' ? 'Pending' : status === 'used' ? 'Used' : 'Expired'}
                    </StatusBadge>
                    {status === 'pending' && (
                      <>
                        <IconButton
                          onClick={() => handleCopyToken(inv.token)}
                          title="Copy invite link"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                        </IconButton>
                        <DeleteIconButton
                          onClick={() => handleDelete(inv.id)}
                          disabled={deletingId === inv.id}
                          title="Delete invitation"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                          </svg>
                        </DeleteIconButton>
                      </>
                    )}
                  </InvitationRight>
                </InvitationRow>
              )
            })}
          </InvitationList>
        </Card>
      )}
    </PageWrapper>
  )
}
