import { describe, it, expect } from 'vitest'
import { loginSchema, setupPasswordSchema, createUserSchema, saveOrderSchema } from './validations'

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    const result = loginSchema.safeParse({ username: 'admin', password: 'secret' })
    expect(result.success).toBe(true)
  })

  it('rejects empty username', () => {
    const result = loginSchema.safeParse({ username: '', password: 'secret' })
    expect(result.success).toBe(false)
  })

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({ username: 'admin', password: '' })
    expect(result.success).toBe(false)
  })
})

describe('setupPasswordSchema', () => {
  it('accepts matching passwords of sufficient length', () => {
    const result = setupPasswordSchema.safeParse({
      password: 'newpass123',
      confirmPassword: 'newpass123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects passwords shorter than 6 characters', () => {
    const result = setupPasswordSchema.safeParse({
      password: '12345',
      confirmPassword: '12345',
    })
    expect(result.success).toBe(false)
  })

  it('rejects mismatched passwords', () => {
    const result = setupPasswordSchema.safeParse({
      password: 'newpass123',
      confirmPassword: 'different',
    })
    expect(result.success).toBe(false)
  })
})

describe('createUserSchema', () => {
  it('accepts valid user data', () => {
    const result = createUserSchema.safeParse({
      username: 'john_doe',
      displayName: 'John Doe',
      role: 'USER',
    })
    expect(result.success).toBe(true)
  })

  it('accepts ADMIN role', () => {
    const result = createUserSchema.safeParse({
      username: 'admin2',
      displayName: 'Admin Two',
      role: 'ADMIN',
    })
    expect(result.success).toBe(true)
  })

  it('rejects usernames with special characters', () => {
    const result = createUserSchema.safeParse({
      username: 'john doe!',
      displayName: 'John',
      role: 'USER',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid role', () => {
    const result = createUserSchema.safeParse({
      username: 'john',
      displayName: 'John',
      role: 'SUPERADMIN',
    })
    expect(result.success).toBe(false)
  })
})

describe('saveOrderSchema', () => {
  it('accepts valid restaurant name', () => {
    const result = saveOrderSchema.safeParse({ restaurantName: 'Pizza Place' })
    expect(result.success).toBe(true)
  })

  it('rejects empty restaurant name', () => {
    const result = saveOrderSchema.safeParse({ restaurantName: '' })
    expect(result.success).toBe(false)
  })
})
