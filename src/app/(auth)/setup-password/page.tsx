'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import styled from 'styled-components'
import { toast } from 'react-toastify'
import { setupPasswordSchema, type SetupPasswordInput } from '~/lib/validations'
import { setupPassword } from '~/actions/auth'
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

export default function SetupPasswordPage() {
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetupPasswordInput>({
    resolver: zodResolver(setupPasswordSchema),
  })

  const onSubmit = async (data: SetupPasswordInput) => {
    try {
      await setupPassword(data.password)
      toast.success('Password set successfully! Please log in again.')
      await signOut({ redirect: false })
      router.push('/login')
    } catch {
      toast.error('Failed to set password')
    }
  }

  return (
    <Card>
      <CardTitle>Set Your Password</CardTitle>
      <Description>Please set a new password for your account.</Description>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <div>
          <Input
            {...register('password')}
            type="password"
            placeholder="New password"
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
          {isSubmitting ? 'Setting password...' : 'Set Password'}
        </Button>
      </Form>
    </Card>
  )
}
