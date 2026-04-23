'use client'

import styled from 'styled-components'

const Wrapper = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textDim};
`

const Select = styled.select`
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.fontSizes.xs};
`

export interface HostOption {
  id: string
  displayName: string
}

interface HostPickerProps {
  value: string
  onChange: (hostUserId: string) => void
  options: HostOption[]
  label?: string
  id?: string
}

export function HostPicker({ value, onChange, options, label = 'Host', id }: HostPickerProps) {
  return (
    <Wrapper htmlFor={id}>
      {label}:
      <Select id={id} value={value} onChange={e => onChange(e.target.value)}>
        {options.length === 0 && <option value="">No users available</option>}
        {options.map(o => (
          <option key={o.id} value={o.id}>{o.displayName}</option>
        ))}
      </Select>
    </Wrapper>
  )
}
