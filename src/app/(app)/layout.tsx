'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import styled from 'styled-components'
import { Button } from '~/features/ui/components/Button'

const Nav = styled.nav`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
`

const NavLinks = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  flex: 1;
`

const NavLink = styled.button<{ $active: boolean }>`
  background: ${({ $active, theme }) => ($active ? theme.colors.primary : 'transparent')};
  color: ${({ $active, theme }) => ($active ? theme.colors.background : theme.colors.text)};
  border: 1px solid ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.border)};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 500;
  transition: all 0.15s ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`

const MainContent = styled.main`
  max-width: 700px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.lg};
`

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push('/login')
  }

  return (
    <>
      <Nav>
        <NavLinks>
          <NavLink
            $active={pathname === '/orders/new'}
            onClick={() => router.push('/orders/new')}
          >
            New Order
          </NavLink>
          <NavLink
            $active={pathname === '/orders'}
            onClick={() => router.push('/orders')}
          >
            History
          </NavLink>
          <NavLink
            $active={pathname === '/invite'}
            onClick={() => router.push('/invite')}
          >
            Invite
          </NavLink>
          {session?.user?.role === 'ADMIN' && (
            <NavLink
              $active={pathname.startsWith('/admin')}
              onClick={() => router.push('/admin/users')}
            >
              Users
            </NavLink>
          )}
        </NavLinks>
        <NavLink
          $active={pathname === '/settings'}
          onClick={() => router.push('/settings')}
        >
          {session?.user?.name}
        </NavLink>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          Logout
        </Button>
      </Nav>
      <MainContent>{children}</MainContent>
    </>
  )
}
