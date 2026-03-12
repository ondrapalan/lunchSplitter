'use client'

import { useState } from 'react'
import styled from 'styled-components'
import { Button } from '~/features/ui/components/Button'
import { generateCopySummary } from '../utils/formatters'
import type { LunchSession, PersonSummary } from '../types'

const Wrapper = styled.div`
  display: flex;
  justify-content: center;
  margin-top: ${({ theme }) => theme.spacing.md};
`

interface CopySummaryProps {
  session: LunchSession
  summaries: PersonSummary[]
}

export function CopySummary({ session, summaries }: CopySummaryProps) {
  const [copied, setCopied] = useState(false)

  if (summaries.length === 0) return null

  const handleCopy = async () => {
    const text = generateCopySummary(session, summaries)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for non-HTTPS contexts
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Wrapper>
      <Button variant="primary" onClick={handleCopy}>
        {copied ? 'Copied!' : 'Copy Summary'}
      </Button>
    </Wrapper>
  )
}
