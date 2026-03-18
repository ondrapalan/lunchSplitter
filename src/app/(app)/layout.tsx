'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import styled from 'styled-components'
import { useThemeMode } from '~/features/ui/theme/ThemeContext'
import { media } from '~/features/ui/theme'

const Nav = styled.nav`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};

  ${media.mobile} {
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    gap: ${({ theme }) => theme.spacing.xs};
  }
`

const NavLinks = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  flex: 1;

  ${media.mobile} {
    gap: ${({ theme }) => theme.spacing.xs};
  }
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
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
  }

  ${media.mobile} {
    min-height: 44px;
    padding: ${({ theme }) => theme.spacing.sm};
    justify-content: center;
  }
`

const NavLabel = styled.span`
  ${media.mobile} {
    display: none;
  }
`

const NavIcon = styled.span`
  display: inline-flex;
  line-height: 0;
`

const MainContent = styled.main`
  max-width: 700px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.lg};

  ${media.mobile} {
    padding: ${({ theme }) => theme.spacing.sm};
  }
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
            title="New Order"
          >
            <NavIcon>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </NavIcon>
            <NavLabel>New Order</NavLabel>
          </NavLink>
          <NavLink
            $active={pathname === '/orders'}
            onClick={() => router.push('/orders')}
            title="All Orders"
          >
            <NavIcon>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </NavIcon>
            <NavLabel>All Orders</NavLabel>
          </NavLink>
          <NavLink
            $active={pathname === '/invite'}
            onClick={() => router.push('/invite')}
            title="Invite"
          >
            <NavIcon>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
              </svg>
            </NavIcon>
            <NavLabel>Invite</NavLabel>
          </NavLink>
          {session?.user?.role === 'ADMIN' && (
            <NavLink
              $active={pathname.startsWith('/admin')}
              onClick={() => router.push('/admin/users')}
              title="Users"
            >
              <NavIcon>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </NavIcon>
              <NavLabel>Users</NavLabel>
            </NavLink>
          )}
        </NavLinks>
        <NavLink
          $active={pathname === '/settings'}
          onClick={() => router.push('/settings')}
          title={session?.user?.name || 'Settings'}
        >
          <NavIcon>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </NavIcon>
          <NavLabel>{session?.user?.name || 'Settings'}</NavLabel>
        </NavLink>
        <NavLink $active={false} onClick={toggleTheme} title={themeTitle} aria-label={themeTitle}>
          <NavIcon>
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
          </NavIcon>
        </NavLink>
        <NavLink $active={false} onClick={handleLogout} title="Logout">
          <NavIcon>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </NavIcon>
          <NavLabel>Logout</NavLabel>
        </NavLink>
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
