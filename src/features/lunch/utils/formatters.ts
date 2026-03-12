import type { LunchSession, PersonSummary } from '../types'
import { calculateNetFees, calculateFeePerPerson } from './calculations'

export function wasEdited(createdAt: string, updatedAt: string): boolean {
  return Math.abs(new Date(updatedAt).getTime() - new Date(createdAt).getTime()) > 10_000
}

export function formatCurrency(value: number): string {
  return value.toFixed(2)
}

export function formatFeeAmount(amount: number): string {
  return amount >= 0 ? `+${amount}` : `${amount}`
}

export function generateCopySummary(session: LunchSession, summaries: PersonSummary[]): string {
  const lines: string[] = []

  for (const person of session.people) {
    const summary = summaries.find(s => s.personId === person.id)
    if (!summary) continue

    lines.push(`${person.name}:`)
    for (const item of person.items) {
      const sharerCount = item.sharedWith.length > 0 ? item.sharedWith.length + 1 : 1
      const shareNote = sharerCount > 1 ? ` (1/${sharerCount})` : ''
      lines.push(`  ${item.name}${shareNote}    ${item.price}`)
    }
    // Items shared from other people
    for (const otherPerson of session.people) {
      if (otherPerson.id === person.id) continue
      for (const item of otherPerson.items) {
        if (!item.sharedWith.includes(person.id)) continue
        const sharerCount = item.sharedWith.length + 1
        const share = item.customShares?.[person.id] ?? item.price / sharerCount
        lines.push(`  ${item.name} (from ${otherPerson.name})    ${formatCurrency(share)}`)
      }
    }
    lines.push('  ---------------------------')
    lines.push(`  Subtotal:            ${formatCurrency(summary.subtotal)}`)
    lines.push(`  After discount:      ${formatCurrency(summary.afterDiscount)}`)
    lines.push(`  With fees:           ${formatCurrency(summary.withFees)}`)
    lines.push('')
  }

  if (session.globalDiscountPercent > 0) {
    lines.push(`Discount: ${session.globalDiscountPercent}%`)
  }

  if (session.feeAdjustments.length > 0) {
    lines.push('Fees:')
    for (const fee of session.feeAdjustments) {
      lines.push(`  ${fee.name}: ${formatFeeAmount(fee.amount)}`)
    }
    const netFees = calculateNetFees(session.feeAdjustments)
    const perPerson = calculateFeePerPerson(netFees, session.people.length)
    lines.push(`Fee per person: ${formatCurrency(perPerson)}`)
  }

  return lines.join('\n')
}
