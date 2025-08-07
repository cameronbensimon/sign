import { SignIn as ClerkSignIn } from '@clerk/clerk-react';
import { useAuth } from '@clerk/clerk-react';
import { redirect } from 'react-router';

import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Sign In');
}

export function loader() {
  // For now, we'll handle authentication redirects on the client side with Clerk
  // The loader can be simplified since Clerk handles auth state
  return {};
}

export default function SignIn() {
  const { isSignedIn } = useAuth();

  // Redirect if already signed in
  if (isSignedIn) {
    redirect('/');
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md">
        <ClerkSignIn
          redirectUrl="/"
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
