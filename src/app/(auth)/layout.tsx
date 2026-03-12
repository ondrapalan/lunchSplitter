'use client'

import styled from 'styled-components'

const AuthContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: ${({ theme }) => theme.spacing.lg};
`

const AuthBox = styled.div`
  width: 100%;
  max-width: 400px;
`

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthContainer>
      <AuthBox>{children}</AuthBox>
    </AuthContainer>
  )
}
