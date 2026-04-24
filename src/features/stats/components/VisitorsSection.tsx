'use client'

import styled from 'styled-components'
import { Card, CardTitle } from '~/features/ui/components/Card'
import { useStatsBundle } from '~/lib/queries/stats'
import { formatCurrency } from '~/features/lunch/utils/formatters'
import { media } from '~/features/ui/theme'

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`

const Th = styled.th`
  text-align: left;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 500;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`

const ThRight = styled(Th)`
  text-align: right;
`

const Td = styled.td`
  padding: ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`

const TdRight = styled(Td)`
  text-align: right;
  font-variant-numeric: tabular-nums;
`

const Empty = styled.td`
  padding: ${({ theme }) => theme.spacing.lg};
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
`

const HideMobile = styled.span`
  ${media.mobile} {
    display: none;
  }
`

const CardGap = styled.div`
  margin-top: ${({ theme }) => theme.spacing.md};
`

export function VisitorsSection() {
  const { data: bundle, isPending: loading } = useStatsBundle('all')
  const visitors = bundle?.visitors ?? []
  const hospitality = bundle?.hospitality ?? []

  return (
    <div>
      <Card>
        <CardTitle>Hospitable Hosts</CardTitle>
        <Table>
          <thead>
            <tr>
              <Th>Host</Th>
              <ThRight>Guest lunches</ThRight>
              <ThRight><HideMobile>Distinct guests</HideMobile></ThRight>
              <ThRight>Total covered</ThRight>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><Empty colSpan={4}>Loading...</Empty></tr>
            ) : hospitality.length === 0 ? (
              <tr><Empty colSpan={4}>No hosted guests yet</Empty></tr>
            ) : (
              hospitality.map(e => (
                <tr key={e.hostUserId}>
                  <Td>{e.hostName}</Td>
                  <TdRight>{e.guestLunchCount}</TdRight>
                  <TdRight><HideMobile>{e.distinctGuestCount}</HideMobile></TdRight>
                  <TdRight>{formatCurrency(e.totalCovered)}</TdRight>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      <CardGap />

      <Card>
        <CardTitle>Visitors</CardTitle>
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th><HideMobile>Usual host</HideMobile></Th>
              <ThRight>Visits</ThRight>
              <ThRight><HideMobile>Last visit</HideMobile></ThRight>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><Empty colSpan={4}>Loading...</Empty></tr>
            ) : visitors.length === 0 ? (
              <tr><Empty colSpan={4}>No guests yet</Empty></tr>
            ) : (
              visitors.map(v => (
                <tr key={v.guestId}>
                  <Td>{v.name}</Td>
                  <Td><HideMobile>{v.defaultHostName}</HideMobile></Td>
                  <TdRight>{v.visitCount}</TdRight>
                  <TdRight>
                    <HideMobile>
                      {v.lastVisit ? new Date(v.lastVisit).toLocaleDateString() : '—'}
                    </HideMobile>
                  </TdRight>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}
