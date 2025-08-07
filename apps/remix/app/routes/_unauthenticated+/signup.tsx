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

  // Clerk handles authentication redirects automatically
  return {};
}

export default function SignUp() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-md">
        <ClerkSignUp
          fallbackRedirectUrl="/"
          signInUrl="/signin"
          appearance={{
            baseTheme: undefined,
            elements: {
              rootBox: 'w-full',
              card: 'w-full shadow-lg border border-gray-200 rounded-xl bg-white',
              headerTitle: 'text-2xl font-semibold text-gray-900',
              headerSubtitle: 'text-gray-600 text-sm',
              socialButtonsBlockButton: 'border border-gray-300 hover:bg-gray-50 text-gray-700',
              formButtonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white',
              footerActionLink: 'text-blue-600 hover:text-blue-700',
              formFieldInput: 'border-gray-300 text-gray-900 bg-white',
              formFieldLabel: 'text-gray-700',
              identityPreviewText: 'text-gray-600',
              identityPreviewEditButton: 'text-blue-600 hover:text-blue-700',
              otpCodeFieldInput: 'border-gray-300 text-gray-900 bg-white',
              alertText: 'text-gray-700',
              formFieldInputShowPasswordButton: 'text-gray-500 hover:text-gray-700',
              dividerText: 'text-gray-500',
              dividerLine: 'bg-gray-200',
            },
          }}
        />
      </div>
    </div>
  );
}
