import { z } from 'zod'

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

export const setupPasswordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const createUserSchema = z.object({
  username: z.string().min(1, 'Username is required').regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores'),
  displayName: z.string().min(1, 'Display name is required'),
  role: z.enum(['ADMIN', 'USER']),
})

export const registerSchema = z.object({
  username: z.string().min(1, 'Username is required').regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores'),
  displayName: z.string().min(1, 'Display name is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const updateDisplayNameSchema = z.object({
  displayName: z.string().min(1, 'Display name is required'),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const saveOrderSchema = z.object({
  restaurantName: z.string().min(1, 'Restaurant name is required'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type SetupPasswordInput = z.infer<typeof setupPasswordSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type UpdateDisplayNameInput = z.infer<typeof updateDisplayNameSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export const updateBankAccountSchema = z.object({
  bankAccountNumber: z
    .string()
    .min(1, 'Bank account number is required')
    .refine(
      (val) => {
        // Czech format: optional prefix-accountNumber/bankCode
        const czechFormat = /^\d{1,6}?-?\d{2,10}\/\d{4}$/
        // IBAN format: CZ + 22 digits
        const ibanFormat = /^CZ\d{22}$/
        return czechFormat.test(val) || ibanFormat.test(val)
      },
      { message: 'Enter Czech format (e.g. 123456789/0800) or IBAN (CZ + 22 digits)' },
    ),
})

export type SaveOrderInput = z.infer<typeof saveOrderSchema>
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>
