import { SignIn as ClerkSignIn, useAuth } from '@clerk/react-router';
import { Navigate } from 'react-router';

import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Sign In');
}

export function loader() {
  // Clerk handles authentication redirects automatically
  return {};
}

export default function SignIn() {
  const { isSignedIn, isLoaded } = useAuth();

  // If signed in and loaded, redirect to home
  if (isSignedIn && isLoaded) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-md">
        <ClerkSignIn
          fallbackRedirectUrl="/"
          signUpUrl="/signup"
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
