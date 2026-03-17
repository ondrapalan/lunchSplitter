'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import styled from 'styled-components'
import { toast } from 'react-toastify'
import { createUserSchema, type CreateUserInput } from '~/lib/validations'
import { createUser, resetUserPassword } from '~/actions/auth'
import { listUsers } from '~/actions/users'
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

interface UserListItem {
  id: string
  username: string
  displayName: string
  role: string
  isFirstLogin: boolean
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
            </UserActions>
          </UserRow>
        ))}
      </UserList>
    </div>
  )
}
