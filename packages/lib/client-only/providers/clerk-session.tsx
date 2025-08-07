import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import React from 'react';

import { useAuth, useOrganizationList, useUser } from '@clerk/react-router';
import type { Session } from '@prisma/client';
import { useLocation } from 'react-router';

import type { SessionUser } from '@documenso/auth/server/lib/session/session';
import { trpc } from '@documenso/trpc/client';
import type { TGetOrganisationSessionResponse } from '@documenso/trpc/server/organisation-router/get-organisation-session.types';

import { SKIP_QUERY_BATCH_META } from '../../constants/trpc';

export type ClerkAppSession = {
  session: Session;
  user: SessionUser;
  organisations: TGetOrganisationSessionResponse;
};

interface ClerkSessionProviderProps {
  children: React.ReactNode;
}

interface ClerkSessionContextValue {
  sessionData: ClerkAppSession | null;
  refreshSession: () => Promise<void>;
  isLoading: boolean;
}

const ClerkSessionContext = createContext<ClerkSessionContextValue | null>(null);

export const useSession = () => {
  const context = useContext(ClerkSessionContext);

  if (!context) {
    throw new Error('useSession must be used within a ClerkSessionProvider');
  }

  // Don't throw error if session is loading - this allows components to handle loading state
  if (!context.sessionData) {
    if (context.isLoading) {
      throw new Error('Session is still loading');
    } else {
      throw new Error('Session not found');
    }
  }

  return {
    ...context.sessionData,
    refreshSession: context.refreshSession,
  };
};

export const useOptionalSession = () => {
  const context = useContext(ClerkSessionContext);

  if (!context) {
    throw new Error('useOptionalSession must be used within a ClerkSessionProvider');
  }

  return context;
};

export const ClerkSessionProvider = ({ children }: ClerkSessionProviderProps) => {
  const { isSignedIn, userId, sessionId } = useAuth();
  const { user: clerkUser } = useUser();
  const { userMemberships } = useOrganizationList();

  const [session, setSession] = useState<ClerkAppSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const location = useLocation();

  const refreshSession = useCallback(async () => {
    if (!isSignedIn || !clerkUser || !userId || !sessionId) {
      console.log('ClerkSession: Not signed in or missing user data');
      setSession(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      console.log('ClerkSession: Refreshing session for user:', userId);

      // Get user email
      const email = clerkUser.primaryEmailAddress?.emailAddress;
      if (!email) {
        throw new Error('No email address found for Clerk user');
      }

      let localUser;
      try {
        // Try to get or create a local user record based on Clerk user ID
        localUser = await trpc.user.getOrCreateByClerkId.query({
          clerkUserId: userId,
          email,
          name: clerkUser.fullName || clerkUser.firstName || '',
        });
        console.log('ClerkSession: Successfully got/created local user:', localUser.id);
      } catch (trpcError) {
        console.error('ClerkSession: TRPC call failed, creating temporary user:', trpcError);
        // Fallback: create a temporary user object
        localUser = {
          id: parseInt(userId.slice(-8), 16) || 1, // Convert part of Clerk ID to number as temp ID
          name: clerkUser.fullName || clerkUser.firstName || 'Unknown',
          email: email,
          emailVerified:
            clerkUser.primaryEmailAddress?.verification?.status === 'verified' ? new Date() : null,
        };
      }

      // Get organisations from local database
      let organisations: TGetOrganisationSessionResponse = [];
      try {
        organisations = await trpc.organisation.internal.getOrganisationSession.query(
          undefined,
          SKIP_QUERY_BATCH_META.trpc,
        );
        console.log('ClerkSession: Got organisations:', organisations.length);
      } catch (orgError) {
        console.error('ClerkSession: Failed to get organisations:', orgError);
        organisations = [];
      }

      // Create a session object that matches the expected format
      const sessionData: ClerkAppSession = {
        session: {
          id: sessionId,
          userId: localUser.id,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
        } as Session,
        user: {
          id: localUser.id,
          name: localUser.name,
          email: localUser.email,
          emailVerified: localUser.emailVerified,
          // Map other fields as needed
        } as SessionUser,
        organisations,
      };

      console.log('ClerkSession: Successfully created session data');
      setSession(sessionData);
    } catch (error) {
      console.error('ClerkSession: Failed to refresh session:', error);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, clerkUser, userId, sessionId]);

  useEffect(() => {
    const onFocus = () => {
      void refreshSession();
    };

    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshSession]);

  /**
   * Refresh session in background on navigation.
   */
  useEffect(() => {
    void refreshSession();
  }, [location.pathname, refreshSession]);

  // Initial session load
  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  return (
    <ClerkSessionContext.Provider
      value={{
        sessionData: session,
        refreshSession,
        isLoading,
      }}
    >
      {children}
    </ClerkSessionContext.Provider>
  );
};
