import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, type UseFormReturn } from 'react-hook-form';

import { signInWithEmail, signInWithGoogle } from '@/api/authClient';
import { useSession } from '@/context/SessionContext';
import { normaliseError } from '@/lib/errors';
import { clearSignInHint, readSignInHint, writeSignInHint } from '@/lib/signInHint';
import { isDesktop } from '@/lib/shell';
import { signInSchema } from '@/schemas/auth.schema';
import type { SignInValues } from '@/schemas/auth.schema';

const googleError = (urlError: string | null): string | null => {
  if (urlError === null) return null;
  if (urlError === 'state_mismatch') {
    return 'Google sign-in session expired or was blocked by browser shields. Please try again or sign in with your email and password below.';
  }
  return `Authentication notice: ${urlError}. Please sign in with your email and password below.`;
};

export interface ShellSignIn {
  form: UseFormReturn<SignInValues>;
  formError: string | null;
  googleBusy: boolean;
  startGoogle: () => void;
  submit: (event?: React.BaseSyntheticEvent) => Promise<void>;
}

export function useShellSignIn(options: { restoreDesktopEmail?: boolean } = {}): ShellSignIn {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refresh } = useSession();
  const [formError, setFormError] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const rememberedEmail =
    options.restoreDesktopEmail === true && isDesktop ? readSignInHint() : null;

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: rememberedEmail ?? '', password: '', rememberMe: true },
  });

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signInWithEmail(values);
      if (values.rememberMe) {
        writeSignInHint(values.email);
      } else {
        clearSignInHint();
      }
      await refresh();
      void navigate(isDesktop ? '/dashboard' : '/', { replace: true });
    } catch (error) {
      setFormError(normaliseError(error).message);
    }
  });

  const startGoogle = (): void => {
    setFormError(null);
    setGoogleBusy(true);
    void signInWithGoogle('/portal')
      .catch((error: unknown) => {
        setFormError(normaliseError(error).message);
      })
      .finally(() => {
        setGoogleBusy(false);
      });
  };

  return {
    form,
    formError: formError ?? googleError(searchParams.get('error')),
    googleBusy,
    startGoogle,
    submit,
  };
}
