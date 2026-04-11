import { z } from 'zod'

export const loginSchema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const registerSchema = z.object({
  name: z.string().min(2, 'Name too short'),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const bookingSchema = z.object({
  guestName: z.string().min(2),
  guestMobile: z.string().regex(/^[6-9]\d{9}$/),
  guestEmail: z.string().email().optional().or(z.literal('')),
  visitDate: z.string().datetime(),
  adults: z.number().int().min(1).max(50),
  children: z.number().int().min(0).max(50),
  ticketTypeId: z.string().uuid(),
})

export const leadSchema = z.object({
  name: z.string().min(2),
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  email: z.string().email().optional().or(z.literal('')),
  source: z.string().optional(),
  notes: z.string().optional(),
})

export const manualUpiSchema = z.object({
  bookingId: z.string().uuid(),
  upiRef: z.string().min(6, 'Invalid UPI reference'),
  amount: z.number().positive(),
  screenshot: z.string().optional(),
})
