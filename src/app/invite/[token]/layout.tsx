'use client'

import styled from 'styled-components'

const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: ${({ theme }) => theme.spacing.lg};
`

const Box = styled.div`
  width: 100%;
  max-width: 400px;
`

export default function InviteTokenLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container>
      <Box>{children}</Box>
    </Container>
  )
}
