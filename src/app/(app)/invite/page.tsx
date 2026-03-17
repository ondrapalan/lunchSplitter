'use client'

import { useState, useEffect } from 'react'
import styled from 'styled-components'
import { toast } from 'react-toastify'
import { createInvitation, getMyInvitations } from '~/actions/invitations'
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

  const loadInvitations = async () => {
    const result = await getMyInvitations()
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
          <LinkRow style={{ marginTop: '12px' }}>
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
                  </InvitationInfo>
                  <StatusBadge $status={status}>
                    {status === 'pending' ? 'Pending' : status === 'used' ? 'Used' : 'Expired'}
                  </StatusBadge>
                </InvitationRow>
              )
            })}
          </InvitationList>
        </Card>
      )}
    </PageWrapper>
  )
}
