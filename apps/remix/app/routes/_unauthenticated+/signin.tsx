import { SignIn as ClerkSignIn, useAuth } from '@clerk/react-router';
import { Navigate } from 'react-router';

import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Sign In');
}

export function loader() {
  return {};
}

export default function SignIn() {
  const { isSignedIn, isLoaded } = useAuth();

  if (isSignedIn && isLoaded) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-screen items-center justify-center bg-white">
      <ClerkSignIn fallbackRedirectUrl="/" signUpUrl="/signup" />
    </div>
  );
}
