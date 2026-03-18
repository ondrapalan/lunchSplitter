'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import styled from 'styled-components'
import { Button } from '~/features/ui/components/Button'
import { useThemeMode } from '~/features/ui/theme/ThemeContext'

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

const Footer = styled.footer`
  text-align: center;
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.colors.textDim};
  font-size: ${({ theme }) => theme.fontSizes.xs};

  a {
    color: ${({ theme }) => theme.colors.textMuted};
    text-decoration: none;

    &:hover {
      color: ${({ theme }) => theme.colors.primary};
    }
  }
`

const ThemeToggle = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.xs};
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textMuted};
  transition: all 0.15s ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primary};
  }
`

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  const { mode, toggleTheme } = useThemeMode()
  const themeTitle = mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'

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
            All Orders
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
          {session?.user?.name || 'Settings'}
        </NavLink>
        <ThemeToggle onClick={toggleTheme} title={themeTitle} aria-label={themeTitle}>
          {mode === 'light' && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          )}
          {mode === 'dark' && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </ThemeToggle>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          Logout
        </Button>
      </Nav>
      <MainContent>{children}</MainContent>
      <Footer>
        <a href="https://github.com/ondrapalan/lunchSplitter" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </Footer>
    </>
  )
}
