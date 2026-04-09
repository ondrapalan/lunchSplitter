'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import styled from 'styled-components'
import { toast } from 'react-toastify'
import { createUserSchema, type CreateUserInput } from '~/lib/validations'
import { createUser, resetUserPassword } from '~/actions/auth'
import { listUsers, deleteUser, updateUserAliases } from '~/actions/users'
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

const AliasRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  margin-top: ${({ theme }) => theme.spacing.xs};
`

const AliasTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: ${({ theme }) => theme.colors.surfaceLight};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  padding: 2px ${({ theme }) => theme.spacing.xs};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
`

const RemoveAlias = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.textDim};
  cursor: pointer;
  padding: 0;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  line-height: 1;

  &:hover {
    color: ${({ theme }) => theme.colors.negative};
  }
`

const AliasInput = styled.input`
  background: transparent;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.text};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  padding: 2px ${({ theme }) => theme.spacing.xs};
  width: 100px;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`

interface UserListItem {
  id: string
  username: string
  displayName: string
  role: string
  isFirstLogin: boolean
  aliases: string[]
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

  const handleAddAlias = async (userId: string, alias: string) => {
    const user = users.find(u => u.id === userId)
    if (!user || !alias.trim()) return
    const newAliases = [...user.aliases, alias.trim()]
    try {
      await updateUserAliases(userId, newAliases)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, aliases: newAliases } : u))
    } catch {
      toast.error('Failed to add alias')
    }
  }

  const handleRemoveAlias = async (userId: string, index: number) => {
    const user = users.find(u => u.id === userId)
    if (!user) return
    const newAliases = user.aliases.filter((_, i) => i !== index)
    try {
      await updateUserAliases(userId, newAliases)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, aliases: newAliases } : u))
    } catch {
      toast.error('Failed to remove alias')
    }
  }

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
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    <circle cx="9.5" cy="10" r="1.5" fill="currentColor" stroke="none" />
                    <circle cx="14.5" cy="10" r="1.5" fill="currentColor" stroke="none" />
                  </svg>
                </StatusIcon>
              </StatusIcons>
              {user.isFirstLogin && <UserMeta> - pending password setup</UserMeta>}
              <AliasRow>
                {user.aliases.map((alias, i) => (
                  <AliasTag key={i}>
                    {alias}
                    <RemoveAlias onClick={() => handleRemoveAlias(user.id, i)} title="Remove alias">&times;</RemoveAlias>
                  </AliasTag>
                ))}
                <AliasInput
                  placeholder="+ alias"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleAddAlias(user.id, e.currentTarget.value)
                      e.currentTarget.value = ''
                    }
                  }}
                />
              </AliasRow>
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
