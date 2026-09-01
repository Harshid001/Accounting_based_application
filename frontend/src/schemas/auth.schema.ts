import { z } from 'zod';

import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '@/lib/constants';

export const emailField = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .email('That does not look like a complete email address.')
  .toLowerCase();

export const passwordField = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  .max(MAX_PASSWORD_LENGTH, `Keep it under ${MAX_PASSWORD_LENGTH} characters.`);

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Enter your password.'),
  rememberMe: z.boolean(),
});
export type SignInValues = z.infer<typeof signInSchema>;

export const signUpSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name.').max(120, 'Keep this under 120 characters.'),
    email: emailField,
    password: passwordField,
    confirmPassword: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Both passwords must match.',
      });
    }
    const haystack = value.password.toLowerCase();
    const name = value.name.toLowerCase();
    const localPart = value.email.split('@')[0]?.toLowerCase() ?? '';
    if (name.length > 2 && haystack.includes(name)) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message: 'Your password cannot contain your own name.',
      });
    }
    if (localPart.length > 2 && haystack.includes(localPart)) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message: 'Your password cannot contain your email address.',
      });
    }
  });
export type SignUpValues = z.infer<typeof signUpSchema>;

export const forgotPasswordSchema = z.object({ email: emailField });
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Both passwords must match.',
      });
    }
  });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
