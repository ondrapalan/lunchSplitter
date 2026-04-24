'use client'

import styled from 'styled-components'
import { Skeleton, SkeletonTitle } from '~/features/ui/components/Skeleton'

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`

const Row = styled(Skeleton).attrs({ $height: '72px' })`
  margin-bottom: 0;
`

export default function Loading() {
  return (
    <div>
      <SkeletonTitle />
      <List>
        <Row />
        <Row />
        <Row />
      </List>
    </div>
  )
}
