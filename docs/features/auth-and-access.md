# Auth & access

Who can log in, how they get there, and what they're allowed to do once inside.

## Stack

- **NextAuth v5 (beta)** with the Credentials provider, configured in `src/lib/auth.ts`.
- **Session strategy: JWT** with an 8-hour max age. The token and session carry `id`, `role` (`USER` | `ADMIN`), and `isFirstLogin`.
- **bcrypt** for password hashing, with a timing-safe dummy hash on the unknown-user path to prevent enumeration.
- **Middleware** (`src/middleware.ts`) redirects unauthenticated requests away from the `(app)` routes toward `/login`.

## Ways in

### 1. Login (`/login`)
Standard credentials form. On success NextAuth issues a JWT. If the account has `isFirstLogin: true`, the user is routed to `/setup-password` before the app shell renders.

### 2. Bootstrap: first admin (`registerFirstAdmin`)
A server action in `src/actions/auth.ts` that creates the very first `ADMIN` account. Guarded by a serializable transaction that checks user count is 0 — a second caller gets a clean error instead of racing. Returns a generated temp password the bootstrapper must use once, then change via `/setup-password`.

### 3. Admin-issued invites
Admin mints an `Invitation { token, invitedById, expiresAt }`. The invitee visits `/invite/[token]`:
- `validateInviteToken(token)` rejects unknown, expired, or already-used tokens.
- `registerWithInvite({ token, username, displayName, password })` creates the user and stamps `Invitation.usedAt/usedById`, then auto-signs the user in.

### 4. Self-serve access requests (`/request-access`)
Anyone can submit `{ username, displayName, password }`:
- Creates an `AccessRequest { status: 'pending', passwordHash }`.
- Discord-DMs every admin with **Approve** / **Deny** buttons via `sendAccessRequestDm`.
- On button press, `src/app/api/discord/interactions/route.ts → handleAccessRequest`:
  - **Approve** → creates the `User` from the stored request, flips `AccessRequest.status = 'approved'`, edits the admin's DM with a confirmation embed.
  - **Deny** → flips to `'denied'`, edits DM.
- If Discord isn't configured, admins can approve from a web page instead (they see pending rows in the admin area).

### 5. Admin "create user" (`createUser`)
Admin fills a form in `/admin/users` and gets a temp password back. The new user is flagged `isFirstLogin: true` and must change it on first login. Validates Discord ID format (17–20 digits) and rejects duplicates.

### 6. First-login password setup (`/setup-password`)
Server action `setupPassword(newPassword)` rehashes, clears `isFirstLogin`, and the shell becomes accessible. Requires a valid session (so users can only set their own password).

### 7. Admin password reset (`resetUserPassword`)
Generates a new temp password and re-flags `isFirstLogin: true`. Used when a user forgets theirs.

## Roles

Two values in the `Role` enum: `USER`, `ADMIN`.

| Capability | USER | ADMIN |
|---|---|---|
| Create orders | ✅ | ✅ |
| Join/leave any open order | ✅ | ✅ |
| Edit orders they created | ✅ | ✅ |
| Edit orders they didn't create | — | ✅ (close/reopen/delete everything; full edit via the detail page) |
| View `/admin/*` | — | ✅ |
| Manage users, guests, items, Discord links | — | ✅ |
| Approve access requests | — | ✅ |

Role checks live in each server action (`session.user.role !== 'ADMIN'` throws), plus the middleware blocks `/admin/*` for non-admins.

## Per-order access rules

Single source of truth: **`getOrderAccess(order, user)`** in `src/lib/orderAccess.ts`. Every UI action reads off its return value — don't re-derive rules. See [Orders & splitting](./orders-and-splitting.md#access-model) for the capability table.

The important invariants:

- **Creator cannot leave or be removed from their own order** — they always stay as a participant.
- **Closed orders are read-only** except for reopen.
- **Admins can close/reopen/delete any order** but their capability to *edit* goes through the same `canEdit` flag.
- **Guests never authenticate** — they exist only via `OrderPerson.guestId` and have no login path.

## The `currentUserPersonId`

Populated inside `getOrder(orderId)` (not inside `getOrderAccess` itself — the access function takes already-loaded data). It's the `OrderPerson.id` the current user owns in this order, used by the UI to route mutations like `saveMyItems`.

## Unknown Discord users

When someone clicks a Sekačka Join button with a Discord ID that isn't linked to any user, the interactions handler does **not** authenticate them — it records a `PendingDiscordLink` and DMs admins so they can resolve it on `/admin/discord-links`. See [Discord integration](./discord-integration.md) for the full flow.

## Files

| Concern | File |
|---|---|
| NextAuth config (providers, callbacks, session shape) | `src/lib/auth.ts` |
| Login / signup / password actions | `src/actions/auth.ts` |
| Route protection | `src/middleware.ts` |
| Access rules for orders | `src/lib/orderAccess.ts` (+ test) |
| Invite flow UI | `src/app/invite/[token]/` |
| Access request UI | `src/app/(auth)/request-access/page.tsx` |
| Password setup UI | `src/app/(auth)/setup-password/page.tsx` |
| Login UI | `src/app/(auth)/login/page.tsx` |
| Shared zod schemas | `src/lib/validations.ts` |

## Related docs

- [Admin panel](./admin.md) — where admin-only actions live
- [Discord integration](./discord-integration.md) — access-request approvals + pending Discord links
- [Storage & housekeeping](../storage-and-housekeeping.md) — TTLs that prune resolved `AccessRequest` and expired `Invitation` rows
