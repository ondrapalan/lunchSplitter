'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import styled from 'styled-components'
import { AdminBadge } from '~/features/ui/components/AdminBadge'
import { NavIcon, NavLabel, NavLink } from '~/features/ui/components/NavLink'

const Wrapper = styled.div`
  position: relative;
  display: inline-flex;
`

const TriggerBadge = styled(AdminBadge)`
  position: absolute;
  top: -4px;
  right: -4px;
  padding: 1px 6px;
  pointer-events: none;
`

const Dropdown = styled.div`
  position: absolute;
  top: calc(100% + ${({ theme }) => theme.spacing.xs});
  left: 0;
  min-width: 220px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  padding: ${({ theme }) => theme.spacing.xs};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  z-index: 10;
`

const MenuItem = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;
  text-align: left;
  background: ${({ $active, theme }) => ($active ? theme.colors.primary : 'transparent')};
  color: ${({ $active, theme }) => ($active ? theme.colors.background : theme.colors.text)};
  border: 1px solid ${({ $active, theme }) => ($active ? theme.colors.primary : 'transparent')};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 500;
  transition: background 0.15s ease, color 0.15s ease;

  &:hover {
    background: ${({ $active, theme }) =>
      $active ? theme.colors.primary : theme.colors.surfaceLight};
  }
`

interface AdminNavMenuProps {
  pendingLinkCount: number
}

export function AdminNavMenu({ pendingLinkCount }: AdminNavMenuProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const navigate = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  const triggerActive = pathname.startsWith('/admin/')

  return (
    <Wrapper ref={wrapperRef}>
      <NavLink
        $active={triggerActive}
        onClick={() => setOpen((v) => !v)}
        title="Admin"
        aria-label="Admin menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <NavIcon>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3z" />
          </svg>
        </NavIcon>
        {pendingLinkCount > 0 && <TriggerBadge>{pendingLinkCount}</TriggerBadge>}
      </NavLink>
      {open && (
        <Dropdown role="menu">
          <MenuItem
            role="menuitem"
            $active={pathname.startsWith('/admin/users')}
            onClick={() => navigate('/admin/users')}
          >
            <NavIcon>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </NavIcon>
            <NavLabel>Users</NavLabel>
          </MenuItem>
          <MenuItem
            role="menuitem"
            $active={pathname.startsWith('/admin/guests')}
            onClick={() => navigate('/admin/guests')}
          >
            <NavIcon>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 11h-6" /><path d="M19 8v6" />
              </svg>
            </NavIcon>
            <NavLabel>Guests</NavLabel>
          </MenuItem>
          <MenuItem
            role="menuitem"
            $active={pathname.startsWith('/admin/items')}
            onClick={() => navigate('/admin/items')}
          >
            <NavIcon>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </NavIcon>
            <NavLabel>Items</NavLabel>
          </MenuItem>
          <MenuItem
            role="menuitem"
            $active={pathname.startsWith('/admin/discord-links')}
            onClick={() => navigate('/admin/discord-links')}
          >
            <NavIcon>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <circle cx="9.5" cy="10" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="14.5" cy="10" r="1.5" fill="currentColor" stroke="none" />
              </svg>
            </NavIcon>
            <NavLabel>Discord links</NavLabel>
            {pendingLinkCount > 0 && <AdminBadge>{pendingLinkCount}</AdminBadge>}
          </MenuItem>
        </Dropdown>
      )}
    </Wrapper>
  )
}
