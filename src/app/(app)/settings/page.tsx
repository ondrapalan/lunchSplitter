'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import styled from 'styled-components'
import { toast } from 'react-toastify'
import {
  changePasswordSchema,
  updateDisplayNameSchema,
  updateBankAccountSchema,
  updateDiscordIdSchema,
  type ChangePasswordInput,
  type UpdateDisplayNameInput,
  type UpdateBankAccountInput,
  type UpdateDiscordIdInput,
} from '~/lib/validations'
import { changePassword, updateDisplayName, getDisplayName, updateBankAccount, getBankAccount } from '~/actions/auth'
import { linkDiscord, unlinkDiscord, getDiscordId } from '~/actions/discord'
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

const HelperText = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  margin-top: ${({ theme }) => theme.spacing.xs};
`

const SectionGap = styled.div`
  margin-top: ${({ theme }) => theme.spacing.lg};
`

function DisplayNameSection() {
  const { update } = useSession()
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UpdateDisplayNameInput>({
    resolver: zodResolver(updateDisplayNameSchema),
  })

  useEffect(() => {
    getDisplayName().then(name => setValue('displayName', name))
  }, [setValue])

  const onSubmit = async (data: UpdateDisplayNameInput) => {
    await updateDisplayName(data.displayName)
    await update()
    toast.success('Display name updated')
  }

  return (
    <Card>
      <CardTitle>Display Name</CardTitle>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <div>
          <Input
            {...register('displayName')}
            placeholder="Display name"
          />
          {errors.displayName && <ErrorText>{errors.displayName.message}</ErrorText>}
        </div>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save'}
        </Button>
      </Form>
    </Card>
  )
}

function BankAccountSection() {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UpdateBankAccountInput>({
    resolver: zodResolver(updateBankAccountSchema),
  })

  useEffect(() => {
    getBankAccount().then(value => {
      if (value) setValue('bankAccountNumber', value)
    })
  }, [setValue])

  const onSubmit = async (data: UpdateBankAccountInput) => {
    await updateBankAccount(data.bankAccountNumber)
    toast.success('Bank account updated')
  }

  return (
    <Card>
      <CardTitle>Bank Account Number</CardTitle>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <div>
          <Input
            {...register('bankAccountNumber')}
            placeholder="e.g. 123456789/0800 or CZ1830300000002206952014"
          />
          {errors.bankAccountNumber && <ErrorText>{errors.bankAccountNumber.message}</ErrorText>}
          <HelperText>Used for QR payment codes on your orders</HelperText>
        </div>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save'}
        </Button>
      </Form>
    </Card>
  )
}

const LinkedStatus = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`

const LinkedBadge = styled.span<{ $linked: boolean }>`
  color: ${({ $linked, theme }) => $linked ? theme.colors.positive : theme.colors.textMuted};
  font-weight: 500;
`

function DiscordSection() {
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateDiscordIdInput>({
    resolver: zodResolver(updateDiscordIdSchema),
  })

  useEffect(() => {
    getDiscordId().then(id => {
      setCurrentId(id)
      setLoaded(true)
    })
  }, [])

  const onSubmit = async (data: UpdateDiscordIdInput) => {
    const result = await linkDiscord(data.discordId)
    if (result && 'error' in result) {
      toast.error(result.error)
      return
    }
    setCurrentId(data.discordId)
    toast.success('Discord linked')
    reset()
  }

  const handleUnlink = async () => {
    await unlinkDiscord()
    setCurrentId(null)
    toast.success('Discord unlinked')
  }

  if (!loaded) return null

  return (
    <Card>
      <CardTitle>Discord</CardTitle>
      <LinkedStatus>
        <LinkedBadge $linked={!!currentId}>
          {currentId ? `Linked: ${currentId}` : 'Not linked'}
        </LinkedBadge>
        {currentId && (
          <Button variant="danger" size="sm" onClick={handleUnlink}>
            Unlink
          </Button>
        )}
      </LinkedStatus>
      {!currentId && (
        <Form onSubmit={handleSubmit(onSubmit)}>
          <div>
            <Input
              {...register('discordId')}
              placeholder="Your Discord User ID (e.g. 471981616579870732)"
            />
            {errors.discordId && <ErrorText>{errors.discordId.message}</ErrorText>}
            <HelperText>
              Enable Developer Mode in Discord Settings &gt; Advanced, then right-click your name and &quot;Copy User ID&quot;
            </HelperText>
          </div>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Linking...' : 'Link Discord'}
          </Button>
        </Form>
      )}
    </Card>
  )
}

function ChangePasswordSection() {
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
  )
}

export default function SettingsPage() {
  return (
    <div>
      <SectionTitle>Settings</SectionTitle>
      <DisplayNameSection />
      <SectionGap />
      <BankAccountSection />
      <SectionGap />
      <DiscordSection />
      <SectionGap />
      <ChangePasswordSection />
    </div>
  )
}
