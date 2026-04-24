# Payments & QR Platba

After a creator closes an order, every non-creator participant owes them some Czech koruna. Rather than copy-pasting IBAN and amount, the app generates a **QR Platba** code — a standard Czech banking QR that every major Czech banking app recognizes. Paying is a camera tap.

## QR Platba in 30 seconds

QR Platba encodes an **SPD (Short Payment Descriptor)** string in a QR code. Any compliant banking app (KB, Česká Spořitelna, ČSOB, Air Bank, Fio, Raiffeisen, Revolut CZ…) scans it and pre-fills the payment form.

The SPD format looks like:

```
SPD*1.0*ACC:CZ6108000000192000145399*AM:125.00*CC:CZK*X-VS:1234567890*MSG:Burger King
```

Parts are `*`-separated. Keys used here:
- `SPD*1.0` — format marker
- `ACC:<IBAN>` — recipient account (Czech IBAN)
- `AM:<amount>` — amount, 2 decimals, dot separator
- `CC:CZK` — currency
- `X-VS:<variableSymbol>` — variable symbol, used to reconcile which person paid which order
- `MSG:<message>` — free-text description, shows up in the bank statement

## Implementation

All pure utilities live in **`src/features/lunch/utils/qrPlatba.ts`** with unit tests alongside.

### `czechAccountToIban(accountNumber: string): string`

Accepts either a Czech account in the local format (`prefix-account/bank`) or an already-formatted IBAN, returns the IBAN.

```
// Local format: prefix (0-6 digits, optional) + '-' + account (2-10 digits) + '/' + bank (4 digits)
"19-2000145399/0100"   →   "CZ6101000000192000145399"
"192000145399/0800"    →   "CZ3808000000192000145399"
"CZ6108...399"          →   (pass-through)
```

- Prefix is padded to 6 digits, account to 10. BBAN = bank (4) + prefix (6) + account (10) = 20 digits.
- Check digits = `98 - ((BBAN + '123500') mod 97)`, where `123500` is the numeric encoding of `CZ00` (ISO 13616).
- Throws on anything that doesn't match either shape — the UI catches the error and hides the QR instead of rendering bogus data.

### `generateVariableSymbol(orderId: string, personId: string): string`

The variable symbol is a Czech banking field (up to 10 digits) used to tie an incoming payment to the expected row. The app derives it deterministically from `orderId + personId`:

1. Concatenate the two UUIDs.
2. 32-bit djb2 hash.
3. `abs() mod 10_000_000_000`.
4. Zero-pad to 10 digits.

Deterministic, stable across reopens, fits the 10-digit limit, uniformly distributed for the scales the app runs at.

### `buildSpdString({ iban, amount, variableSymbol, message }): string`

Assembles the SPD payload. Key safety step: **strip `*` and `+` from `message`** before joining, because both are reserved separators in the SPD spec — leaving them in would let an item name break the encoding (and, worse, inject fields). Amount is `.toFixed(2)`.

### `<QrPlatba spdString amount size />`

`src/features/lunch/components/QrPlatba.tsx` is the client component that renders the QR image. Uses the `qrcode` npm package to produce a data URL, then renders a plain `<img>` with tooltip-friendly `alt` text.

## Where QRs appear

1. **`/orders` list** — for each closed order the user owes money on, a small QR sits on the row. Code: `OrderQrCode` in `src/app/(app)/orders/page.tsx`.
2. **`/orders/[orderId]`** — inside `PeopleSection`, the QR shows next to each non-creator person's card when the order is closed and the creator has a bank account configured.
3. **Discord DMs** — when `closeOrder` runs with `sendDiscord: true`, the same SPD string is rasterized to a PNG and attached to each participant's DM. Code path: `sendOrderQrCodes → sendPaymentDm → QRCode.toBuffer(spdString, { width: 200, margin: 1, colors })` in `src/actions/discord.ts`.

All three use the **same** `buildSpdString`, so the amount/variable symbol/message is byte-identical regardless of where the user scans.

## Payment confirmations

A `PaymentConfirmation` row per `OrderPerson` tracks who has paid. Three states via `confirmedVia`:

| Value | Meaning |
|---|---|
| `'pending'` | QR sent (via Discord) but not yet confirmed. |
| `'discord'` | User clicked the **Confirm payment** button in the Discord DM. |
| `'manual'` | Creator/admin toggled it via the web UI. |

The row is **absent** entirely if no QR was ever sent (e.g. order closed with "Close silently"). A missing row = "unknown", not "paid".

### Who can write

- `handlePaymentConfirmation` (Discord button) — only the payer themselves, enforced by matching the clicker's Discord ID against `OrderPerson.user.discordId`.
- `togglePaymentConfirmation(orderPersonId)` — creator or admin only. Toggles between deleting the row (if not `pending`) and upserting with `confirmedVia: 'manual'`.

### What the UI shows

- On the `/orders/[orderId]` detail page, the creator sees each participant's card with a checkbox/toggle. State is polled every 30 seconds via `getPaymentConfirmations(orderId)` (see the `useEffect` on the detail page) so Discord-side confirmations light up without a refresh.
- On the `/orders` list, closed orders the user **created** show a `paid/total` badge — count of participants with any non-pending row vs. the number of expected participants.

### Discord-side UX

When the user clicks **Confirm payment**, the original DM is edited:
- The body text is strikethroughed.
- A fresh green embed line reads "Payment confirmed!".
- The button is replaced with a disabled-looking button.

The edit is idempotent — spamming the button doesn't duplicate side effects.

## Files

| Concern | File |
|---|---|
| SPD / IBAN / VS utilities | `src/features/lunch/utils/qrPlatba.ts` (+ `.test.ts`) |
| QR component | `src/features/lunch/components/QrPlatba.tsx` |
| Close-order DM flow | `src/actions/discord.ts → sendOrderQrCodes`, `sendPaymentDm` |
| Confirm button handler | `src/app/api/discord/interactions/route.ts → handlePaymentConfirmation` |
| Web toggle + polling | `src/actions/discord.ts → togglePaymentConfirmation`, `getPaymentConfirmations` |

## Related docs

- [Orders & splitting](./orders-and-splitting.md) — where the `amount` comes from
- [Discord integration](./discord-integration.md) — the DM transport
- [Auth & access](./auth-and-access.md) — who can toggle confirmations
