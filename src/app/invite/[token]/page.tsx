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

    if ('error' in result && result.error) {
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
