'use client'

import { useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'
import Link from 'next/link'
import { toast } from 'react-toastify'
import { listItemNameUsage, bulkMarkPackaging, type ItemNameUsage } from '~/actions/items'
import { Button } from '~/features/ui/components/Button'
import { Card, CardTitle } from '~/features/ui/components/Card'
import { Input } from '~/features/ui/components/Input'
import { SectionTitle } from '~/features/ui/components/SectionTitle'

const FilterBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.md};
`

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

const PackagingPill = styled.span<{ $on: boolean }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  background: ${({ $on, theme }) => $on ? theme.colors.surfaceLight : 'transparent'};
  color: ${({ $on, theme }) => $on ? theme.colors.secondary : theme.colors.textDim};
  border: 1px solid ${({ theme }) => theme.colors.border};
`

const StickyBar = styled.div`
  position: sticky;
  bottom: 0;
  background: ${({ theme }) => theme.colors.background};
  padding: ${({ theme }) => theme.spacing.md} 0;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
`

const Count = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  margin-right: auto;
`

export default function AdminItemsPage() {
  const [rows, setRows] = useState<ItemNameUsage[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)

  const reload = async () => {
    try {
      const data = await listItemNameUsage()
      setRows(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load items')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return q ? rows.filter(r => r.name.toLowerCase().includes(q)) : rows
  }, [rows, filter])

  const toggle = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const clearSelection = () => setSelected(new Set())

  const applyBulk = async (isPackaging: boolean) => {
    if (selected.size === 0) return
    setApplying(true)
    try {
      const names = [...selected]
      const res = await bulkMarkPackaging(names, isPackaging)
      toast.success(`${isPackaging ? 'Marked' : 'Unmarked'} ${res.updated} item row${res.updated === 1 ? '' : 's'}`)
      clearSelection()
      await reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk update failed')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div>
      <SectionTitle>Packaging backfill</SectionTitle>
      <Link href="/admin/guests">← Back to admin</Link>

      <Card style={{ marginTop: 16 }}>
        <CardTitle>Mark items as packaging</CardTitle>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 4 }}>
          Select item names that represent packaging (boxes, containers). Marked
          items still count toward each person&apos;s bill but are excluded from item-based
          leaderboards (Fan Favourite, Explorer, Bargain Hunter, Gourmet, Feast, Most Consistent).
        </p>
      </Card>

      <FilterBar style={{ marginTop: 16 }}>
        <Input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter by name…"
          style={{ maxWidth: 240 }}
        />
      </FilterBar>

      <Table>
        <thead>
          <tr>
            <Th style={{ width: 32 }}></Th>
            <Th>Item</Th>
            <ThRight>Used</ThRight>
            <ThRight>Avg price</ThRight>
            <Th>Current</Th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr><Td colSpan={5} style={{ textAlign: 'center', padding: 24 }}>Loading…</Td></tr>
          )}
          {!loading && filtered.length === 0 && (
            <tr><Td colSpan={5} style={{ textAlign: 'center', padding: 24 }}>No items match.</Td></tr>
          )}
          {filtered.map(r => (
            <tr key={r.name}>
              <Td>
                <input
                  type="checkbox"
                  checked={selected.has(r.name)}
                  onChange={() => toggle(r.name)}
                />
              </Td>
              <Td>{r.name}</Td>
              <TdRight>{r.count}</TdRight>
              <TdRight>{Math.round(r.avgPrice)} CZK</TdRight>
              <Td>
                <PackagingPill $on={r.allPackaging}>
                  {r.allPackaging
                    ? '📦 packaging'
                    : r.packagingCount > 0
                      ? `${r.packagingCount}/${r.count} packaging`
                      : 'food'}
                </PackagingPill>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      {selected.size > 0 && (
        <StickyBar>
          <Count>{selected.size} selected</Count>
          <Button variant="secondary" size="sm" onClick={clearSelection} disabled={applying}>
            Clear
          </Button>
          <Button variant="secondary" size="sm" loading={applying} onClick={() => applyBulk(false)}>
            Mark as food
          </Button>
          <Button variant="primary" size="sm" loading={applying} onClick={() => applyBulk(true)}>
            Mark as packaging
          </Button>
        </StickyBar>
      )}
    </div>
  )
}
