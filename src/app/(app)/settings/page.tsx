'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import styled from 'styled-components'
import { toast } from 'react-toastify'
import { changePasswordSchema, type ChangePasswordInput } from '~/lib/validations'
import { changePassword } from '~/actions/auth'
import { Input } from '~/features/ui/components/Input'
import { Button } from '~/features/ui/components/Button'
import { Card, CardTitle } from '~/features/ui/components/Card'
import { SectionTitle } from '~/features/ui/components/SectionTitle'

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

export default function SettingsPage() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  })

  const onSubmit = async (data: ChangePasswordInput) => {
    const result = await changePassword(data.currentPassword, data.newPassword)
    if ('error' in result && result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Password changed successfully')
    reset()
  }

  return (
    <div>
      <SectionTitle>Settings</SectionTitle>
      <Card>
        <CardTitle>Change Password</CardTitle>
        <Form onSubmit={handleSubmit(onSubmit)}>
          <div>
            <Input
              {...register('currentPassword')}
              type="password"
              placeholder="Current password"
              autoComplete="current-password"
            />
            {errors.currentPassword && <ErrorText>{errors.currentPassword.message}</ErrorText>}
          </div>
          <div>
            <Input
              {...register('newPassword')}
              type="password"
              placeholder="New password"
              autoComplete="new-password"
            />
            {errors.newPassword && <ErrorText>{errors.newPassword.message}</ErrorText>}
          </div>
          <div>
            <Input
              {...register('confirmPassword')}
              type="password"
              placeholder="Confirm new password"
              autoComplete="new-password"
            />
            {errors.confirmPassword && <ErrorText>{errors.confirmPassword.message}</ErrorText>}
          </div>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Changing...' : 'Change Password'}
          </Button>
        </Form>
      </Card>
    </div>
  )
}
