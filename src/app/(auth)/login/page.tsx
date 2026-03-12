'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import styled from 'styled-components'
import { toast } from 'react-toastify'
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from '~/lib/validations'
import { hasAnyUsers, registerFirstAdmin } from '~/actions/auth'
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

export default function LoginPage() {
  const router = useRouter()
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)

  useEffect(() => {
    hasAnyUsers().then(exists => setNeedsSetup(!exists))
  }, [])

  if (needsSetup === null) return null
  if (needsSetup) return <RegisterForm onDone={() => setNeedsSetup(false)} />
  return <LoginForm router={router} />
}

function LoginForm({ router }: { router: ReturnType<typeof useRouter> }) {
  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginInput) => {
    setError('')
    const result = await signIn('credentials', {
      username: data.username,
      password: data.password,
      redirect: false,
    })
    if (result?.error) {
      setError('Invalid username or password')
    } else {
      router.push('/orders')
      router.refresh()
    }
  }

  return (
    <Card>
      <CardTitle>Lunch Splitter</CardTitle>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <div>
          <Input {...register('username')} placeholder="Username" autoComplete="username" />
          {errors.username && <ErrorText>{errors.username.message}</ErrorText>}
        </div>
        <div>
          <Input
            {...register('password')}
            type="password"
            placeholder="Password"
            autoComplete="current-password"
          />
          {errors.password && <ErrorText>{errors.password.message}</ErrorText>}
        </div>
        {error && <ErrorText>{error}</ErrorText>}
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in...' : 'Login'}
        </Button>
      </Form>
    </Card>
  )
}

function RegisterForm({ onDone }: { onDone: () => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterInput) => {
    const result = await registerFirstAdmin({
      username: data.username,
      displayName: data.displayName,
      password: data.password,
    })
    if ('error' in result && result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Admin account created! You can now log in.')
    onDone()
  }

  return (
    <Card>
      <CardTitle>Lunch Splitter</CardTitle>
      <Description>No users yet. Create your admin account to get started.</Description>
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
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Admin Account'}
        </Button>
      </Form>
    </Card>
  )
}
