import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import React from 'react';

import { useAuth, useOrganizationList, useUser } from '@clerk/react-router';
import type { Session } from '@prisma/client';
import { Role } from '@prisma/client';

import type { SessionUser } from '@documenso/auth/server/lib/session/session';
import { trpc } from '@documenso/trpc/client';
import type { TGetOrganisationSessionResponse } from '@documenso/trpc/server/organisation-router/get-organisation-session.types';

import { SKIP_QUERY_BATCH_META } from '../../constants/trpc';
import { getAuthenticatedUser } from '../utils/session-guards';

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

  // Don't throw error if session is loading or missing - let components handle gracefully
  if (!context.sessionData) {
    if (context.isLoading) {
      // Return loading state instead of throwing
      return {
        session: null,
        user: null,
        organisations: [],
        refreshSession: context.refreshSession,
        isLoading: true,
      };
    } else {
      // Return null state instead of throwing
      return {
        session: null,
        user: null,
        organisations: [],
        refreshSession: context.refreshSession,
        isLoading: false,
      };
    }
  }

  return {
    ...context.sessionData,
    refreshSession: context.refreshSession,
    isLoading: context.isLoading,
  };
};

export const useOptionalSession = () => {
  const context = useContext(ClerkSessionContext);

  if (!context) {
    throw new Error('useOptionalSession must be used within a ClerkSessionProvider');
  }

  return context;
};

// Hook specifically for authenticated routes that guarantees user exists
export const useAuthenticatedSession = () => {
  const context = useContext(ClerkSessionContext);

  if (!context) {
    throw new Error('useAuthenticatedSession must be used within a ClerkSessionProvider');
  }

  // In authenticated routes, if session is loading, show loading state
  if (context.isLoading) {
    // Return loading state with null values but indicate loading
    return {
      session: null,
      user: null,
      organisations: [],
      refreshSession: context.refreshSession,
      isLoading: true,
    };
  }

  // In authenticated routes, if no session data, throw error (should not happen)
  if (!context.sessionData || !context.sessionData.user) {
    throw new Error('User not authenticated - this should not happen in authenticated routes');
  }

  return {
    ...context.sessionData,
    refreshSession: context.refreshSession,
    isLoading: context.isLoading,
  };
};

// Hook for authenticated routes that guarantees non-null user
export const useAuthenticatedUser = () => {
  const { user, ...rest } = useSession();
  return {
    user: getAuthenticatedUser(user),
    ...rest,
  };
};

export const ClerkSessionProvider = ({ children }: ClerkSessionProviderProps) => {
  const { isSignedIn, userId, sessionId } = useAuth();
  const { user: clerkUser } = useUser();
  const { userMemberships, isLoaded: orgsIsLoaded } = useOrganizationList();

  const [session, setSession] = useState<ClerkAppSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Use refs to avoid dependency loops
  const lastRefreshTimeRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const sessionRef = useRef<ClerkAppSession | null>(null);

  // Session cache duration (5 minutes)
  const SESSION_CACHE_DURATION = 5 * 60 * 1000;

  // Update sessionRef when session changes
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const refreshSession = useCallback(
    async (force = false) => {
      // Access clerkUser directly from hook (always current)
      const currentClerkUser = clerkUser;

      // Don't refresh if not authenticated or if already refreshing
      if (!isSignedIn || !currentClerkUser || !userId || !sessionId || isRefreshingRef.current) {
        if (!isSignedIn || !currentClerkUser || !userId || !sessionId) {
          console.log('ClerkSession: Not signed in or missing user data');
          setSession(null);
          setIsLoading(false);
        }
        return;
      }

      // Check if session is still fresh (unless forced)
      const now = Date.now();
      if (
        !force &&
        sessionRef.current &&
        now - lastRefreshTimeRef.current < SESSION_CACHE_DURATION
      ) {
        console.log('ClerkSession: Using cached session data');
        setIsLoading(false);
        return;
      }

      try {
        isRefreshingRef.current = true;
        setIsLoading(true);
        console.log('ClerkSession: Refreshing session for user:', userId);

        // Get user email
        const email = currentClerkUser.primaryEmailAddress?.emailAddress;
        if (!email) {
          throw new Error('No email address found for Clerk user');
        }

        let localUser;
        try {
          // Try to get or create a local user record based on Clerk user ID
          localUser = await trpc.user.getOrCreateByClerkId.query({
            clerkUserId: userId,
            email,
            name: currentClerkUser.fullName || currentClerkUser.firstName || '',
          });
          console.log('ClerkSession: Successfully got/created local user:', localUser.id);
        } catch (trpcError) {
          console.error('ClerkSession: TRPC call failed, creating temporary user:', trpcError);
          // Fallback: create a temporary user object
          localUser = {
            id: parseInt(userId.slice(-8), 16) || 1, // Convert part of Clerk ID to number as temp ID
            name: currentClerkUser.fullName || currentClerkUser.firstName || 'Unknown',
            email: email,
            emailVerified:
              currentClerkUser.primaryEmailAddress?.verification?.status === 'verified'
                ? new Date()
                : null,
            avatarImageId: null,
            twoFactorEnabled: false,
            roles: [Role.USER],
            signature: null,
          };
        }

        // Sync Clerk organizations to local database first (using unauthenticated endpoint during session setup)
        if (orgsIsLoaded && userMemberships?.data?.length) {
          try {
            for (const membership of userMemberships.data) {
              const clerkOrg = membership.organization;
              await trpc.organisation.internal.syncClerkOrgUnauthenticated.mutate({
                clerkOrgId: clerkOrg.id,
                name: clerkOrg.name,
                url: clerkOrg.slug || clerkOrg.id,
                clerkUserId: userId, // Pass the Clerk user ID for lookup
              });
            }
            console.log(
              'ClerkSession: Synced',
              userMemberships.data.length,
              'organizations from Clerk',
            );
          } catch (syncError) {
            console.error('ClerkSession: Failed to sync Clerk organizations:', syncError);
          }
        }

        // Get organisations from local database (using unauthenticated endpoint during session setup)
        let organisations: TGetOrganisationSessionResponse = [];
        try {
          organisations =
            await trpc.organisation.internal.getOrganisationSessionUnauthenticated.query(
              { clerkUserId: userId },
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
            sessionToken: sessionId, // Use sessionId as token
            userId: localUser.id,
            ipAddress: null, // Not available from Clerk
            userAgent: null, // Not available from Clerk
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          user: {
            id: localUser.id,
            name: localUser.name,
            email: localUser.email,
            emailVerified: localUser.emailVerified,
            avatarImageId: localUser.avatarImageId || null,
            twoFactorEnabled: localUser.twoFactorEnabled || false,
            roles: localUser.roles || [Role.USER],
            signature: localUser.signature || null,
          },
          organisations,
        };

        console.log('ClerkSession: Successfully created session data');
        setSession(sessionData);
        // Update refs after successful operation
        const currentTime = Date.now();
        // eslint-disable-next-line require-atomic-updates
        lastRefreshTimeRef.current = currentTime;
      } catch (error) {
        console.error('ClerkSession: Failed to refresh session:', error);
        setSession(null);
      } finally {
        setIsLoading(false);
        // Reset refreshing flag
        const isRefreshingCurrent = isRefreshingRef.current;
        if (isRefreshingCurrent) {
          isRefreshingRef.current = false;
        }
      }
    },
    [isSignedIn, userId, sessionId],
  ); // Stable dependencies only - clerkUser accessed directly

  // Single useEffect for session management
  useEffect(() => {
    // Only refresh on initial load or when auth state changes
    void refreshSession();

    // Set up window focus listener for session refresh (but not immediate)
    const onFocus = () => {
      // Only refresh on focus if session is stale
      void refreshSession(false);
    };

    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshSession]); // Now refreshSession won't change constantly due to refs

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
