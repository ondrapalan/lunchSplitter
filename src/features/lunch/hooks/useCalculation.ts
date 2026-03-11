import { useMemo } from 'react'
import type { LunchSession, PersonSummary } from '../types'
import { calculatePersonSummaries, calculateNetFees, calculateFeePerPerson } from '../utils/calculations'

interface CalculationResult {
  summaries: PersonSummary[]
  netFees: number
  feePerPerson: number
  grandTotal: number
}

export function useCalculation(session: LunchSession): CalculationResult {
  return useMemo(() => {
    const summaries = calculatePersonSummaries(session)
    const netFees = calculateNetFees(session.feeAdjustments)
    const feePerPerson = calculateFeePerPerson(netFees, session.people.length)
    const grandTotal = summaries.reduce((sum, s) => sum + s.withFees, 0)

    return { summaries, netFees, feePerPerson, grandTotal }
  }, [session])
}
