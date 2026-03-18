import { describe, it, expect } from 'vitest'
import { buildSpdString, czechAccountToIban, generateVariableSymbol } from './qrPlatba'

describe('buildSpdString', () => {
  it('builds a valid SPD string', () => {
    const result = buildSpdString({
      iban: 'CZ6508000000192000145399',
      amount: 135.50,
      variableSymbol: '1234567890',
      message: 'Pizza Palace',
    })
    expect(result).toBe(
      'SPD*1.0*ACC:CZ6508000000192000145399*AM:135.50*CC:CZK*X-VS:1234567890*MSG:Pizza Palace',
    )
  })

  it('formats amount to 2 decimal places', () => {
    const result = buildSpdString({
      iban: 'CZ6508000000192000145399',
      amount: 100,
      variableSymbol: '0000000001',
      message: '',
    })
    expect(result).toContain('AM:100.00')
  })
})

describe('czechAccountToIban', () => {
  it('converts simple account number to IBAN', () => {
    const iban = czechAccountToIban('2206952014/3030')
    expect(iban).toMatch(/^CZ\d{22}$/)
    expect(iban.length).toBe(24)
    // Bank code 3030 should appear after CZ + 2 check digits
    expect(iban.substring(4, 8)).toBe('3030')
  })

  it('converts account with prefix to IBAN', () => {
    const iban = czechAccountToIban('19-2000145399/0800')
    expect(iban).toMatch(/^CZ\d{22}$/)
    expect(iban.length).toBe(24)
    expect(iban.substring(4, 8)).toBe('0800')
  })

  it('returns IBAN as-is', () => {
    const iban = czechAccountToIban('CZ6508000000192000145399')
    expect(iban).toBe('CZ6508000000192000145399')
  })

  it('throws on invalid format', () => {
    expect(() => czechAccountToIban('invalid')).toThrow('Invalid Czech bank account format')
  })

  it('produces valid check digits (MOD 97 validation)', () => {
    // A valid IBAN should satisfy: numeric(BBAN + country_digits) mod 97 === 1
    const iban = czechAccountToIban('2206952014/3030')
    const bban = iban.substring(4)
    // Move country+check to end, convert letters to numbers (C=12, Z=35)
    const numericStr = bban + '1235' + iban.substring(2, 4)
    let remainder = 0
    for (const ch of numericStr) {
      remainder = (remainder * 10 + parseInt(ch, 10)) % 97
    }
    expect(remainder).toBe(1)
  })
})

describe('generateVariableSymbol', () => {
  it('returns a string of max 10 digits', () => {
    const vs = generateVariableSymbol('clxxxxxxxxxxxxxxxxx', 'clyyyyyyyyyyyyyyyyyy')
    expect(vs).toMatch(/^\d{1,10}$/)
    expect(vs.length).toBeLessThanOrEqual(10)
  })

  it('is deterministic', () => {
    const vs1 = generateVariableSymbol('order123', 'person456')
    const vs2 = generateVariableSymbol('order123', 'person456')
    expect(vs1).toBe(vs2)
  })

  it('produces different values for different inputs', () => {
    const vs1 = generateVariableSymbol('order-a', 'person-1')
    const vs2 = generateVariableSymbol('order-b', 'person-2')
    expect(vs1).not.toBe(vs2)
  })
})
