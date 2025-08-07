import { SignUp as ClerkSignUp } from '@clerk/react-router';
import { useAuth } from '@clerk/react-router';
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
  const { isSignedIn } = useAuth();

  // Redirect if already signed in
  if (isSignedIn) {
    redirect('/');
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md">
        <ClerkSignUp
          redirectUrl="/"
          signInUrl="/signin"
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'w-full shadow-lg border rounded-xl bg-white dark:bg-neutral-900',
              headerTitle: 'text-2xl font-semibold',
              headerSubtitle: 'text-muted-foreground text-sm',
              socialButtonsBlockButton:
                'border border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800',
              formButtonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white',
              footerActionLink: 'text-blue-600 hover:text-blue-700',
            },
          }}
        />
      </div>
    </div>
  );
}
