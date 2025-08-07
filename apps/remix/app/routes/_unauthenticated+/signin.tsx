import { SignIn as ClerkSignIn, useAuth } from '@clerk/react-router';

import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Sign In');
}

export function loader() {
  // Clerk handles authentication redirects automatically
  return {};
}

export default function SignIn() {
  const { isSignedIn, userId, isLoaded } = useAuth();

  // Debug: Show auth state
  console.log('SignIn page - Auth state:', { isSignedIn, userId, isLoaded });

  // If signed in, show debug info instead of sign-in form
  if (isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-md rounded-lg border bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-semibold text-green-600">✅ You are signed in!</h2>
          <p className="mb-2 text-sm text-gray-600">User ID: {userId}</p>
          <p className="mb-4 text-sm text-gray-600">
            If you're not being redirected, there might be an issue with the session provider.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => (window.location.href = '/')}
              className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md">
        <ClerkSignIn
          fallbackRedirectUrl="/"
          signUpUrl="/signup"
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
