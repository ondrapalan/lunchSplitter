'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import styled from 'styled-components'
import { toast } from 'react-toastify'
import { registerSchema, type RegisterInput } from '~/lib/validations'
import { submitAccessRequest } from '~/actions/accessRequests'
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

const SuccessMessage = styled.div`
  text-align: center;
  color: ${({ theme }) => theme.colors.positive};
  font-weight: 500;
  padding: ${({ theme }) => theme.spacing.md};
`

const BackLink = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  margin-top: ${({ theme }) => theme.spacing.sm};
  text-align: center;
  display: block;
  width: 100%;

  &:hover {
    text-decoration: underline;
  }
`

export default function RequestAccessPage() {
  const router = useRouter()
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterInput) => {
    const result = await submitAccessRequest(data)
    if (result && 'error' in result) {
      toast.error(result.error)
      return
    }
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <Card>
        <CardTitle>Request Sent</CardTitle>
        <SuccessMessage>
          Your request has been sent to the admin for approval. You will be able to log in once approved.
        </SuccessMessage>
        <BackLink onClick={() => router.push('/login')}>Back to Login</BackLink>
      </Card>
    )
  }

  return (
    <Card>
      <CardTitle>Request Access</CardTitle>
      <Description>Fill in your details. An admin will review your request.</Description>
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
          <Input {...register('password')} type="password" placeholder="Password" autoComplete="new-password" />
          {errors.password && <ErrorText>{errors.password.message}</ErrorText>}
        </div>
        <div>
          <Input {...register('confirmPassword')} type="password" placeholder="Confirm password" autoComplete="new-password" />
          {errors.confirmPassword && <ErrorText>{errors.confirmPassword.message}</ErrorText>}
        </div>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Sending...' : 'Request Access'}
        </Button>
      </Form>
      <BackLink onClick={() => router.push('/login')}>Back to Login</BackLink>
    </Card>
  )
}
