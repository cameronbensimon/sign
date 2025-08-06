'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { useAuth, useOrganization, useUser } from '@clerk/nextjs';

import { trpc } from '@documenso/trpc/react';

// Types for backward compatibility
export type AppSession = {
  user: {
    id: number;
    name: string | null;
    email: string;
    emailVerified: Date | null;
    clerkUserId?: string | null;
    avatarImageId?: string | null;
    signature?: string | null;
    roles: string[];
    disabled: boolean;
  };
  organisations: Array<{
    id: string;
    name: string;
    url: string;
    clerkOrganizationId?: string | null;
    type: string;
    avatarImageId?: string | null;
    role: string;
  }>;
};

type SessionContextValue = {
  sessionData: AppSession | null;
  refreshSession: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

type SessionProviderProps = {
  children: React.ReactNode;
};

export const ClerkSessionProvider = ({ children }: SessionProviderProps) => {
  const { userId, isSignedIn } = useAuth();
  const { user: clerkUser } = useUser();
  const { organization: clerkOrg } = useOrganization();

  const [session, setSession] = useState<AppSession | null>(null);

  // Query to get user data from our database based on Clerk user ID
  const { data: userData } = trpc.user.getByClerkId.useQuery(
    { clerkUserId: userId || '' },
    { enabled: !!userId && isSignedIn },
  );

  const refreshSession = useCallback(() => {
    if (!isSignedIn || !clerkUser || !userData) {
      setSession(null);
      return;
    }

    // Build session from Clerk + our database data
    const appSession: AppSession = {
      user: {
        id: userData.id,
        name: userData.name || clerkUser.fullName,
        email: userData.email,
        emailVerified: userData.emailVerified,
        clerkUserId: userData.clerkUserId,
        avatarImageId: userData.avatarImageId,
        signature: userData.signature,
        roles: userData.roles,
        disabled: userData.disabled,
      },
      organisations: userData.organisations || [],
    };

    setSession(appSession);
  }, [isSignedIn, clerkUser, userData]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  return (
    <SessionContext.Provider
      value={{
        sessionData: session,
        refreshSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }

  const { sessionData } = context;

  if (!sessionData) {
    throw new Error('User is not authenticated');
  }

  return {
    user: sessionData.user,
    organisations: sessionData.organisations,
    refreshSession: context.refreshSession,
  };
};

export const useOptionalSession = () => {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useOptionalSession must be used within a SessionProvider');
  }

  return {
    sessionData: context.sessionData,
    refreshSession: context.refreshSession,
  };
};
