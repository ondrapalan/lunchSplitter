'use client'

import styled from 'styled-components'
import { Button } from '~/features/ui/components/Button'
import { Card, CardTitle } from '~/features/ui/components/Card'

const ErrorContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  padding: ${({ theme }) => theme.spacing.lg};
`

const ErrorMessage = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`

const DigestLabel = styled.p`
  color: ${({ theme }) => theme.colors.textDim};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`

const Digest = styled.code`
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  word-break: break-all;
`

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorContainer>
      <Card>
        <CardTitle>Something went wrong</CardTitle>
        <ErrorMessage>
          {error.message || 'An unexpected error occurred.'}
        </ErrorMessage>
        {error.digest && (
          <>
            <DigestLabel>
              Share this reference when reporting the issue:
            </DigestLabel>
            <Digest>{error.digest}</Digest>
          </>
        )}
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
      </Card>
    </ErrorContainer>
  )
}
