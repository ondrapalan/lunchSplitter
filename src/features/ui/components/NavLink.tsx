'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import styled, { css } from 'styled-components'
import { media } from '~/features/ui/theme'
import { useNavigationGuard } from '~/features/lunch/components/NavigationGuard'

const navItemCss = css<{ $active: boolean }>`
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
  text-decoration: none;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
  }

  ${media.mobile} {
    min-height: 44px;
    padding: ${({ theme }) => theme.spacing.sm};
    justify-content: center;
  }
`

const StyledNavLink = styled(Link)<{ $active: boolean }>`
  ${navItemCss}
`

// Renders an <a href>, so Ctrl/Cmd+click and middle-click open in a new tab
// while plain clicks fall through to Next.js client-side navigation. Plain
// clicks consult NavigationGuardProvider so unsaved drafts can intercept.
type NavLinkProps = React.ComponentProps<typeof StyledNavLink>

export function NavLink({ onClick, href, ...rest }: NavLinkProps) {
  const { requestLeave } = useNavigationGuard()
  const router = useRouter()

  const handleClick = useCallback(
    async (e: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(e)
      if (e.defaultPrevented) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return

      e.preventDefault()
      const ok = await requestLeave()
      if (ok) {
        router.push(typeof href === 'string' ? href : href.toString())
      }
    },
    [href, onClick, requestLeave, router],
  )

  return <StyledNavLink href={href} {...rest} onClick={handleClick} />
}

// Same look, but a real <button> for non-navigation actions
// (theme toggle, logout, dropdown trigger).
export const NavButton = styled.button<{ $active: boolean }>`
  ${navItemCss}
`

export const NavLabel = styled.span`
  ${media.mobile} {
    display: none;
  }
`

export const NavIcon = styled.span`
  display: inline-flex;
  line-height: 0;
`
