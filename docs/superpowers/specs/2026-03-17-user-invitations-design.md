# User Invitations Design

## Overview

Any logged-in user can generate a time-limited invite link. The recipient clicks the link and registers with username, password, and display name. New users get the USER role.

## Data Model

New `Invitation` model in Prisma:

| Field       | Type     | Notes                                      |
|-------------|----------|--------------------------------------------|
| id          | String   | cuid, primary key                          |
| token       | String   | @unique, cryptographically random (UUID v4)|
| invitedById | String   | FK to User who created the invitation      |
| createdAt   | DateTime | auto-set                                   |
| expiresAt   | DateTime | createdAt + 7 days                         |
| usedAt      | DateTime | nullable, set when someone registers       |
| usedById    | String   | nullable, @unique, FK to User who registered|

Relations:
- `invitedBy` -> User (many invitations per user)
- `usedBy` -> User (one-to-one, nullable — each user can only be the result of one invitation)

## Invite Generation Flow

1. User clicks "Invite" link in the navbar
2. Navigates to `/invite` page
3. User clicks "Generate invite link" button
4. Server action:
   - Check the user has fewer than 5 active (non-expired, non-used) invitations; reject if at limit
   - Generates a token via `crypto.randomUUID()`
   - Stores `Invitation` with `expiresAt = now + 7 days`
   - Opportunistic cleanup: deletes all invitations globally where `expiresAt < now AND usedAt IS NULL` (expired unused invitations are garbage; used invitations are preserved for history regardless of expiry)
   - Returns the full URL (e.g., `https://domain/invite/{token}`)
5. UI shows the link with a copy-to-clipboard button
6. Page also shows a list of the user's past invitations with status (pending/used/expired)

## Registration Flow

1. Recipient visits `/invite/[token]` (public route, no auth required)
2. Server checks:
   - Token exists in DB
   - Not expired (`expiresAt > now`)
   - Not already used (`usedAt` is null)
   - If any check fails, show an appropriate error message
3. Valid token renders a registration form:
   - Username (required, min 1 char, alphanumeric + underscores only)
   - Display name (required, min 1 char)
   - Password (required, min 6 chars)
   - Confirm password (must match password)
4. On submit (server action):
   - Validate all fields with Zod (reuse existing `registerSchema`)
   - Re-check token validity (not expired, not used) to prevent race conditions
   - Check username uniqueness
   - Create User with role=USER, `isFirstLogin=false`, bcrypt-hashed password
   - Mark invitation as used: set `usedAt = now`, `usedById = newUser.id`
   - Run both operations in a Prisma transaction
   - Return `{ success: true }` to the client
5. Client-side: call `signIn('credentials', { username, password, redirect: false })` with the credentials the user just entered (same pattern as existing login page)
6. Redirect to `/orders`

## UI Details

### Navbar
- Add "Invite" link next to existing navigation items
- Visible to all logged-in users (both USER and ADMIN)

### Invite Management Page (`/invite`)
- Protected route (requires auth, inside `(app)` route group)
- Path: `src/app/(app)/invite/page.tsx`
- "Generate invite link" button at the top
- After generating: shows the link in a read-only input with a "Copy" button
- Below: list of user's invitations showing:
  - Created date
  - Status badge: "Pending" (not used, not expired), "Used" (usedAt set), "Expired" (past expiresAt, not used)
  - Who used it (display name, if used)

### Registration Page (`/invite/[token]`)
- Public route, placed outside route groups: `src/app/invite/[token]/page.tsx`
  - This avoids route conflicts with the protected `/invite` page in `(app)`
  - Has its own minimal layout (same centered card style as auth pages)
- Styled consistently with existing `/login` and `/setup-password` pages
- Shows error state if token is invalid/expired/used
- Shows registration form if token is valid
- Submit button with loading state
- Toast notification on success

## Validation Schema

Reuse the existing `registerSchema` from `src/lib/validations.ts` — it already validates username (min 1, alphanumeric + underscores), displayName, password (min 6), and confirmPassword with matching check. No new schema needed.

## Middleware

Update `src/middleware.ts` to allow unauthenticated access to `/invite/[token]` registration pages. Add a check before the auth gate:

```typescript
// Public: invite registration pages
if (nextUrl.pathname.startsWith('/invite/') && nextUrl.pathname !== '/invite') {
  return undefined
}
```

This allows `/invite/abc-123` (registration) to be public while `/invite` (management page) remains protected by the existing auth check.

## Security

- Token is `crypto.randomUUID()` — cryptographically random, not guessable
- Expiration checked server-side from DB `expiresAt` field, not derivable from URL
- Token is single-use — marked used in same transaction as user creation
- `usedById` has `@unique` constraint — prevents double-use at DB level
- Rate limit: max 5 active (pending, non-expired) invitations per user
- No admin approval required
- Invited users always get USER role; only admins can promote

## Affected Files

### New files:
- `prisma/migrations/..._add_invitation/migration.sql` — generated by Prisma
- `src/app/(app)/invite/page.tsx` — invite management page (protected)
- `src/app/invite/[token]/page.tsx` — registration page (public, outside route groups)
- `src/actions/invitations.ts` — server actions for invite generation + registration

### Modified files:
- `prisma/schema.prisma` — add Invitation model
- `src/middleware.ts` — whitelist `/invite/[token]` as public route
- `src/app/(app)/layout.tsx` — add "Invite" link to navbar
