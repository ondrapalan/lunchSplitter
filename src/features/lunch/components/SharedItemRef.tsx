import styled from 'styled-components'
import type { Item, Person } from '../types'

const RefRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.xs} 0;
  opacity: 0.7;
`

const LinkIcon = styled.span`
  color: ${({ theme }) => theme.colors.secondary};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`

const RefName = styled.span`
  flex: 1;
  color: ${({ theme }) => theme.colors.secondary};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`

const RefShare = styled.span`
  color: ${({ theme }) => theme.colors.textDim};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`

interface SharedItemRefProps {
  item: Item
  owner: Person
  personId: string
}

export function SharedItemRef({ item, owner, personId }: SharedItemRefProps) {
  const sharerCount = item.sharedWith.length + 1
  const share = item.customShares?.[personId] ?? item.price / sharerCount

  return (
    <RefRow>
      <LinkIcon>~</LinkIcon>
      <RefName>{item.name} (from {owner.name})</RefName>
      <RefShare>your share: {share.toFixed(2)} CZK</RefShare>
    </RefRow>
  )
}
