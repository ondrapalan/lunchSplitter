/**
 * QR Platba (Czech banking standard) utility functions.
 * All pure functions — no side effects.
 */

interface SpdStringParams {
  iban: string
  recipientName: string
  amount: number
  variableSymbol: string
  message: string
}

/** Build a QR Platba SPD string. */
export function buildSpdString({ iban, recipientName, amount, variableSymbol, message }: SpdStringParams): string {
  const parts = [
    'SPD*1.0',
    `ACC:${iban}`,
    `RN:${recipientName}`,
    `AM:${amount.toFixed(2)}`,
    'CC:CZK',
    `X-VS:${variableSymbol}`,
    `MSG:${message}`,
  ]
  return parts.join('*')
}

/**
 * Convert Czech bank account number (e.g. "123456789/0800") to IBAN.
 *
 * Czech IBAN structure: "CZ" + 2 check digits + 4-digit bank code + 6-digit prefix (zero-padded) + 10-digit account (zero-padded)
 * Total: CZ + 2 + 4 + 6 + 10 = 24 characters
 *
 * If already IBAN format, returns as-is.
 */
export function czechAccountToIban(accountNumber: string): string {
  // Already IBAN
  if (accountNumber.startsWith('CZ') && /^CZ\d{22}$/.test(accountNumber)) {
    return accountNumber
  }

  // Parse Czech format: [prefix-]accountNumber/bankCode
  const match = accountNumber.match(/^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/)
  if (!match) {
    throw new Error(`Invalid Czech bank account format: ${accountNumber}`)
  }

  const prefix = (match[1] ?? '').padStart(6, '0')
  const account = match[2].padStart(10, '0')
  const bankCode = match[3]

  // BBAN = bankCode + prefix + account
  const bban = bankCode + prefix + account

  // Calculate check digits per ISO 13616 (MOD 97)
  // Move "CZ00" to end, replace letters: C=12, Z=35
  const numericString = bban + '123500'
  const checkDigits = 98 - mod97(numericString)

  return `CZ${checkDigits.toString().padStart(2, '0')}${bban}`
}

/** MOD 97 for large numeric strings (ISO 7064). */
function mod97(numericString: string): number {
  let remainder = 0
  for (const char of numericString) {
    remainder = (remainder * 10 + parseInt(char, 10)) % 97
  }
  return remainder
}

/**
 * Generate a deterministic variable symbol from orderId + personId.
 * Max 10 digits. Uses a simple hash of the concatenated CUIDs.
 */
export function generateVariableSymbol(orderId: string, personId: string): string {
  const input = orderId + personId
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0 // Force 32-bit integer
  }
  // Ensure positive, max 10 digits
  const positiveHash = Math.abs(hash) % 10_000_000_000
  return positiveHash.toString().padStart(10, '0')
}
