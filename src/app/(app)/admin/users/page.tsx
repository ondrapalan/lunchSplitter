'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import styled from 'styled-components'
import { toast } from 'react-toastify'
import { createUserSchema, type CreateUserInput } from '~/lib/validations'
import { createUser, resetUserPassword } from '~/actions/auth'
import { listUsers, deleteUser } from '~/actions/users'
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

const Select = styled.select`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.text};
  padding: ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.fontSizes.md};
  width: 100%;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`

const TempPasswordBox = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.positive};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.md};
`

const TempPasswordLabel = styled.div`
  color: ${({ theme }) => theme.colors.positive};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`

const TempPassword = styled.code`
  color: ${({ theme }) => theme.colors.text};
  font-size: ${({ theme }) => theme.fontSizes.lg};
  font-weight: 600;
`

const UserList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.md};
`

const UserRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
`

const UserMeta = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`

const UserActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`

const RoleBadge = styled.span<{ $admin: boolean }>`
  color: ${({ $admin, theme }) => ($admin ? theme.colors.warning : theme.colors.textMuted)};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 500;
  text-transform: uppercase;
`

const StatusIcons = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  margin-left: ${({ theme }) => theme.spacing.sm};
  vertical-align: middle;
`

const StatusIcon = styled.span<{ $active: boolean }>`
  display: inline-flex;
  color: ${({ $active, theme }) => ($active ? theme.colors.positive : theme.colors.border)};
  line-height: 0;
`

interface UserListItem {
  id: string
  username: string
  displayName: string
  role: string
  isFirstLogin: boolean
  bankAccountNumber: string | null
  discordId: string | null
}

export default function AdminUsersPage() {
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [resetPassword, setResetPassword] = useState<{ userId: string; password: string } | null>(null)
  const [users, setUsers] = useState<UserListItem[]>([])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: 'USER' },
  })

  const loadUsers = async () => {
    try {
      const result = await listUsers()
      setUsers(result)
    } catch {
      toast.error('Failed to load users')
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleDelete = async (userId: string, displayName: string) => {
    if (!confirm(`Delete user "${displayName}"? Their order participations will be kept as guest entries.`)) return
    try {
      await deleteUser(userId)
      toast.success('User deleted')
      loadUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  const handleReset = async (userId: string) => {
    if (!confirm('Reset this user\'s password? They will need to set a new one on next login.')) return
    setResetPassword(null)
    const result = await resetUserPassword(userId)
    if ('error' in result && result.error) {
      toast.error(result.error)
      return
    }
    if ('tempPassword' in result && result.tempPassword) {
      setResetPassword({ userId, password: result.tempPassword })
      toast.success('Password reset!')
      loadUsers()
    }
  }

  const onSubmit = async (data: CreateUserInput) => {
    setTempPassword(null)
    const result = await createUser(data)
    if ('error' in result && result.error) {
      toast.error(result.error)
      return
    }
    if ('tempPassword' in result && result.tempPassword) {
      setTempPassword(result.tempPassword)
      toast.success('User created!')
      reset()
      loadUsers()
    }
  }

  return (
    <div>
      <SectionTitle>User Management</SectionTitle>

      <Card>
        <CardTitle>Create User</CardTitle>
        <Form onSubmit={handleSubmit(onSubmit)}>
          <div>
            <Input {...register('username')} placeholder="Username" />
            {errors.username && <ErrorText>{errors.username.message}</ErrorText>}
          </div>
          <div>
            <Input {...register('displayName')} placeholder="Display name" />
            {errors.displayName && <ErrorText>{errors.displayName.message}</ErrorText>}
          </div>
          <div>
            <Select {...register('role')}>
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </Select>
          </div>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create User'}
          </Button>
        </Form>

        {tempPassword && (
          <TempPasswordBox>
            <TempPasswordLabel>Temporary password (share with user):</TempPasswordLabel>
            <TempPassword>{tempPassword}</TempPassword>
          </TempPasswordBox>
        )}
      </Card>

      <SectionTitle>Existing Users</SectionTitle>
      <UserList>
        {users.map(user => (
          <UserRow key={user.id}>
            <div>
              <span>{user.displayName}</span>
              <UserMeta> (@{user.username})</UserMeta>
              <StatusIcons>
                <StatusIcon $active={!!user.bankAccountNumber} title={user.bankAccountNumber ? 'Bank account linked' : 'No bank account'}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="10" width="18" height="11" rx="2" />
                    <path d="M12 3L2 10h20L12 3z" />
                    <line x1="7" y1="14" x2="7" y2="17" />
                    <line x1="12" y1="14" x2="12" y2="17" />
                    <line x1="17" y1="14" x2="17" y2="17" />
                  </svg>
                </StatusIcon>
                <StatusIcon $active={!!user.discordId} title={user.discordId ? 'Discord linked' : 'No Discord'}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.5 9a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z" />
                    <path d="M14.5 9a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z" />
                    <path d="M8.5 4.5L7 2" />
                    <path d="M15.5 4.5L17 2" />
                    <path d="M4.28 7.05A17.1 17.1 0 0 1 8.68 4.37a.09.09 0 0 1 .08.04 11.6 11.6 0 0 1 .54 1.11 15.7 15.7 0 0 1 5.4 0c.15-.37.34-.76.54-1.11a.09.09 0 0 1 .08-.04 17.1 17.1 0 0 1 4.4 2.68.08.08 0 0 1 .03.03c2.4 3.53 3.6 7.52 3.13 12.12a.09.09 0 0 1-.03.06 17.1 17.1 0 0 1-5.32 2.69.09.09 0 0 1-.1-.03 12.2 12.2 0 0 1-1.08-1.77.08.08 0 0 1 .04-.1 11.3 11.3 0 0 0 1.66-.8.08.08 0 0 0 .01-.12 8.8 8.8 0 0 1-.33-.26.07.07 0 0 0-.07-.01 12.2 12.2 0 0 1-10.7 0 .07.07 0 0 0-.07.01c-.11.09-.22.18-.33.26a.08.08 0 0 0 0 .12c.52.3 1.08.57 1.66.8a.08.08 0 0 1 .04.1c-.32.62-.68 1.21-1.08 1.77a.09.09 0 0 1-.1.03 17.06 17.06 0 0 1-5.32-2.69.08.08 0 0 1-.03-.05C.44 14.57-.27 10.58.91 7.08a.06.06 0 0 1 .03-.03z" />
                  </svg>
                </StatusIcon>
              </StatusIcons>
              {user.isFirstLogin && <UserMeta> - pending password setup</UserMeta>}
              {resetPassword?.userId === user.id && (
                <TempPasswordBox>
                  <TempPasswordLabel>New temporary password:</TempPasswordLabel>
                  <TempPassword>{resetPassword.password}</TempPassword>
                </TempPasswordBox>
              )}
            </div>
            <UserActions>
              <RoleBadge $admin={user.role === 'ADMIN'}>{user.role}</RoleBadge>
              <Button variant="secondary" size="sm" onClick={() => handleReset(user.id)}>
                Reset PW
              </Button>
              <Button variant="danger" size="sm" onClick={() => handleDelete(user.id, user.displayName)}>
                Delete
              </Button>
            </UserActions>
          </UserRow>
        ))}
      </UserList>
    </div>
  )
}
