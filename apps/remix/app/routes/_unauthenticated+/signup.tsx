import { SignUp as ClerkSignUp } from '@clerk/react-router';
import { redirect } from 'react-router';

import { env } from '@documenso/lib/utils/env';

import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Sign Up');
}

export function loader() {
  const NEXT_PUBLIC_DISABLE_SIGNUP = env('NEXT_PUBLIC_DISABLE_SIGNUP');

  if (NEXT_PUBLIC_DISABLE_SIGNUP === 'true') {
    throw redirect('/signin');
  }

  return {};
}

export default function SignUp() {
  return (
    <div className="flex h-screen items-center justify-center bg-white">
      <ClerkSignUp fallbackRedirectUrl="/" signInUrl="/signin" />
    </div>
  );
}
