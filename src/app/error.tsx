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
  margin-bottom: ${({ theme }) => theme.spacing.md};
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
        <ErrorMessage>{error.message || 'An unexpected error occurred.'}</ErrorMessage>
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
      </Card>
    </ErrorContainer>
  )
}
