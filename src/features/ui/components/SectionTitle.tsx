'use client'

import styled from 'styled-components'

export const SectionTitle = styled.h2`
  color: ${({ theme }) => theme.colors.secondary};
  font-size: ${({ theme }) => theme.fontSizes.lg};
  margin-bottom: ${({ theme }) => theme.spacing.md};

  &:not(:first-child) {
    margin-top: ${({ theme }) => theme.spacing.xl};
  }
`
