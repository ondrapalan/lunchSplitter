# User Invitations Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow any logged-in user to generate time-limited invite links so colleagues can self-register.

**Architecture:** New `Invitation` Prisma model with token-based lookup. Protected `/invite` page for generating/managing links. Public `/invite/[token]` page (outside route groups) for registration. Client-side `signIn()` after server-side user creation.

**Tech Stack:** Prisma, NextAuth v5, react-hook-form + zod, styled-components, bcryptjs

---

## File Structure

### New files:
- `src/actions/invitations.ts` — server actions: `createInvitation`, `getMyInvitations`, `registerWithInvite`, `validateInviteToken`
- `src/app/(app)/invite/page.tsx` — protected invite management page (generate link, view history)
- `src/app/invite/[token]/page.tsx` — public registration page
- `src/app/invite/[token]/layout.tsx` — centered auth-style layout for public registration page

### Modified files:
- `prisma/schema.prisma` — add `Invitation` model + relations on `User`
- `src/middleware.ts` — whitelist `/invite/*` as public
- `src/app/(app)/layout.tsx` — add "Invite" nav link

---

### Task 1: Prisma Schema — Add Invitation Model

**Files:**
- Modify: `prisma/schema.prisma:22-34` (User model — add relations)
- Modify: `prisma/schema.prisma` (append Invitation model)

- [ ] **Step 1: Add Invitation model and User relations to schema**

Add to end of `prisma/schema.prisma`:

```prisma
model Invitation {
  id          String    @id @default(cuid())
  token       String    @unique
  invitedBy   User      @relation("InvitedByUser", fields: [invitedById], references: [id])
  invitedById String
  createdAt   DateTime  @default(now())
  expiresAt   DateTime
  usedAt      DateTime?
  usedBy      User?     @relation("UsedByUser", fields: [usedById], references: [id])
  usedById    String?   @unique
}
```

Add two relation fields to the `User` model (after `orderPersons`):

```prisma
  invitationsSent     Invitation[] @relation("InvitedByUser")
  invitationUsed      Invitation?  @relation("UsedByUser")
```

- [ ] **Step 2: Generate and apply migration**

Run: `npx prisma migrate dev --name add_invitation`
Expected: Migration created and applied successfully, Prisma client regenerated.

- [ ] **Step 3: Commit**

```bash
git add prisma/
git commit -m "feat: add Invitation model to Prisma schema"
```

---

### Task 2: Middleware — Allow Public Access to `/invite/[token]`

**Files:**
- Modify: `src/middleware.ts:11-17`

- [ ] **Step 1: Add public route exception**

In `src/middleware.ts`, add this block after the `/login` public check (after line 17, before the `// Require auth for everything else` comment):

```typescript
  // Public: invite registration pages (but not /invite management page)
  if (nextUrl.pathname.startsWith('/invite/') && nextUrl.pathname !== '/invite') {
    return undefined
  }
```

- [ ] **Step 2: Verify middleware manually**

Run: `npx next build` (or `npm run build`)
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: whitelist /invite/[token] as public route in middleware"
```

---

### Task 3: Server Actions — Invitation Logic

**Files:**
- Create: `src/actions/invitations.ts`

- [ ] **Step 1: Create the invitations server actions file**

Create `src/actions/invitations.ts`:

```typescript
export async function registerWithInvite(
  token: string,
  data: { username: string; displayName: string; password: string; confirmPassword: string },
) {
  // Validate form data
  const parsed = registerSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message }
  }

  // Re-validate token
  const invitation = await prisma.invitation.findUnique({
    where: { token },
  })

  if (!invitation || invitation.usedAt || invitation.expiresAt < new Date()) {
    return { error: 'This invitation is no longer valid' }
  }

  // Check username uniqueness
  const existingUser = await prisma.user.findUnique({
    where: { username: parsed.data.username },
  })
  if (existingUser) {
    return { error: 'Username already exists' }
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10)

  try {
    await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          username: parsed.data.username,
          displayName: parsed.data.displayName,
          passwordHash,
          role: 'USER',
          isFirstLogin: false,
        },
      })

      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          usedAt: new Date(),
          usedById: newUser.id,
        },
      })
    })
  } catch {
    return { error: 'Username already exists' }
  }

  return { success: true }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/actions/invitations.ts
git commit -m "feat: add invitation server actions"
```

---

### Task 4: Invite Management Page (Protected)

**Files:**
- Create: `src/app/(app)/invite/page.tsx`

- [ ] **Step 1: Create the invite management page**

Create `src/app/(app)/invite/page.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import styled from 'styled-components'
import { toast } from 'react-toastify'
import { createInvitation, getMyInvitations } from '~/actions/invitations'
import { Button } from '~/features/ui/components/Button'
import { Input } from '~/features/ui/components/Input'
import { Card, CardTitle } from '~/features/ui/components/Card'
import { SectionTitle } from '~/features/ui/components/SectionTitle'

const PageWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`

const LinkRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: center;
`

const ReadOnlyInput = styled(Input).attrs({ readOnly: true })`
  cursor: text;
`

const InvitationList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`

const InvitationRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
`

const InvitationInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const InvitationDate = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textMuted};
`

const StatusBadge = styled.span<{ $status: 'pending' | 'used' | 'expired' }>`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 500;
  padding: 2px ${({ theme }) => theme.spacing.xs};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ $status, theme }) =>
    $status === 'pending'
      ? theme.colors.warning
      : $status === 'used'
        ? theme.colors.positive
        : theme.colors.textMuted};
`

type InvitationData = {
  id: string
  token: string
  createdAt: string
  expiresAt: string
  usedAt: string | null
  usedByName: string | null
}

function getStatus(inv: InvitationData): 'pending' | 'used' | 'expired' {
  if (inv.usedAt) return 'used'
  if (new Date(inv.expiresAt) < new Date()) return 'expired'
  return 'pending'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  })
}

export default function InvitePage() {
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [invitations, setInvitations] = useState<InvitationData[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  const loadInvitations = async () => {
    const result = await getMyInvitations()
    if ('invitations' in result) {
      setInvitations(result.invitations)
    }
  }

  useEffect(() => {
    loadInvitations()
  }, [])

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const result = await createInvitation()
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      const link = `${window.location.origin}/invite/${result.token}`
      setGeneratedLink(link)
      toast.success('Invite link generated!')
      loadInvitations()
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = async () => {
    if (!generatedLink) return
    await navigator.clipboard.writeText(generatedLink)
    toast.success('Link copied to clipboard!')
  }

  return (
    <PageWrapper>
      <SectionTitle>Invite Colleague</SectionTitle>

      <Card>
        <CardTitle>Generate Invite Link</CardTitle>
        <Button
          variant="primary"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? 'Generating...' : 'Generate Invite Link'}
        </Button>
        {generatedLink && (
          <LinkRow style={{ marginTop: '12px' }}>
            <ReadOnlyInput value={generatedLink} />
            <Button variant="secondary" size="sm" onClick={handleCopy}>
              Copy
            </Button>
          </LinkRow>
        )}
      </Card>

      {invitations.length > 0 && (
        <Card>
          <CardTitle>Your Invitations</CardTitle>
          <InvitationList>
            {invitations.map((inv) => {
              const status = getStatus(inv)
              return (
                <InvitationRow key={inv.id}>
                  <InvitationInfo>
                    <InvitationDate>
                      Created {formatDate(inv.createdAt)}
                    </InvitationDate>
                    {status === 'used' && inv.usedByName && (
                      <InvitationDate>
                        Used by {inv.usedByName}
                      </InvitationDate>
                    )}
                  </InvitationInfo>
                  <StatusBadge $status={status}>
                    {status === 'pending' ? 'Pending' : status === 'used' ? 'Used' : 'Expired'}
                  </StatusBadge>
                </InvitationRow>
              )
            })}
          </InvitationList>
        </Card>
      )}
    </PageWrapper>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(app)/invite/page.tsx
git commit -m "feat: add invite management page"
```

---

### Task 5: Registration Page (Public)

**Files:**
- Create: `src/app/invite/[token]/layout.tsx`
- Create: `src/app/invite/[token]/page.tsx`

- [ ] **Step 1: Create the layout for the public registration page**

Create `src/app/invite/[token]/layout.tsx` — reuse the same centered style as the auth layout:

```tsx
'use client'

import styled from 'styled-components'

const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: ${({ theme }) => theme.spacing.lg};
`

const Box = styled.div`
  width: 100%;
  max-width: 400px;
`

export default function InviteTokenLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container>
      <Box>{children}</Box>
    </Container>
  )
}
```

- [ ] **Step 2: Create the registration page**

Create `src/app/invite/[token]/page.tsx`:

```tsx
'use client'

import { useState, useEffect, use } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import styled from 'styled-components'
import { toast } from 'react-toastify'
import { registerSchema, type RegisterInput } from '~/lib/validations'
import { validateInviteToken, registerWithInvite } from '~/actions/invitations'
import { Input } from '~/features/ui/components/Input'
import { Button } from '~/features/ui/components/Button'
import { Card, CardTitle } from '~/features/ui/components/Card'

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`

const ErrorText = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  margin-top: -${({ theme }) => theme.spacing.xs};
`

const Description = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`

type TokenStatus = { valid: true } | { valid: false; reason: string }

export default function InviteRegisterPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const router = useRouter()
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null)

  useEffect(() => {
    validateInviteToken(token).then(setTokenStatus)
  }, [token])

  if (tokenStatus === null) return null

  if (!tokenStatus.valid) {
    return (
      <Card>
        <CardTitle>Invitation Invalid</CardTitle>
        <Description>{tokenStatus.reason}</Description>
        <Button variant="primary" onClick={() => router.push('/login')}>
          Go to Login
        </Button>
      </Card>
    )
  }

  return <RegisterForm token={token} />
}

function RegisterForm({ token }: { token: string }) {
  const router = useRouter()
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterInput) => {
    setServerError('')
    const result = await registerWithInvite(token, data)

    if ('error' in result) {
      setServerError(result.error)
      return
    }

    // Sign in client-side with the credentials just created
    const signInResult = await signIn('credentials', {
      username: data.username,
      password: data.password,
      redirect: false,
    })

    if (signInResult?.error) {
      // User was created but auto-login failed — send to login page
      toast.success('Account created! Please log in.')
      router.push('/login')
      return
    }

    toast.success('Welcome to Lunch Splitter!')
    router.push('/orders')
    router.refresh()
  }

  return (
    <Card>
      <CardTitle>Join Lunch Splitter</CardTitle>
      <Description>Create your account to start splitting lunches with your colleagues.</Description>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <div>
          <Input {...register('username')} placeholder="Username" autoComplete="username" />
          {errors.username && <ErrorText>{errors.username.message}</ErrorText>}
        </div>
        <div>
          <Input {...register('displayName')} placeholder="Display name" />
          {errors.displayName && <ErrorText>{errors.displayName.message}</ErrorText>}
        </div>
        <div>
          <Input
            {...register('password')}
            type="password"
            placeholder="Password"
            autoComplete="new-password"
          />
          {errors.password && <ErrorText>{errors.password.message}</ErrorText>}
        </div>
        <div>
          <Input
            {...register('confirmPassword')}
            type="password"
            placeholder="Confirm password"
            autoComplete="new-password"
          />
          {errors.confirmPassword && <ErrorText>{errors.confirmPassword.message}</ErrorText>}
        </div>
        {serverError && <ErrorText>{serverError}</ErrorText>}
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account...' : 'Create Account'}
        </Button>
      </Form>
    </Card>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/invite/
git commit -m "feat: add public invite registration page"
```

---

### Task 6: Navbar — Add Invite Link

**Files:**
- Modify: `src/app/(app)/layout.tsx:71-78`

- [ ] **Step 1: Add Invite nav link**

In `src/app/(app)/layout.tsx`, add the Invite link after the History NavLink and before the admin Users check (between lines 70 and 71):

```tsx
          <NavLink
            $active={pathname === '/invite'}
            onClick={() => router.push('/invite')}
          >
            Invite
          </NavLink>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(app)/layout.tsx
git commit -m "feat: add Invite link to navbar"
```

---

### Task 7: Manual Integration Test

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Test invite generation**

1. Log in as any user
2. Click "Invite" in the navbar
3. Click "Generate Invite Link"
4. Verify a link appears and the copy button works
5. Verify the invitation shows as "Pending" in the list

- [ ] **Step 3: Test registration via invite link**

1. Open the generated link in an incognito/private window
2. Verify the registration form appears
3. Fill in username, display name, password, confirm password
4. Submit — verify auto-login and redirect to `/orders`
5. Verify the invitation now shows as "Used" on the inviter's page

- [ ] **Step 4: Test edge cases**

1. Visit the same invite link again — should show "already been used" error
2. Generate 5 invitations, try generating a 6th — should show rate limit error
3. Try registering with a username that already exists — should show error

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address issues found during integration testing"
```
