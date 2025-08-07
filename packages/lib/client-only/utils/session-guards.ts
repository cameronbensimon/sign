import type { SessionUser } from '@documenso/auth/server/lib/session/session';

/**
 * Type guard to ensure user exists in authenticated contexts.
 * Use this in authenticated routes where user should never be null.
 */
export const assertAuthenticatedUser = (user: SessionUser | null): user is SessionUser => {
  if (!user) {
    throw new Error('User not found in authenticated context');
  }
  return true;
};

/**
 * Hook to get non-null user in authenticated routes.
 * This throws an error if user is null, which should not happen in _authenticated+ routes.
 */
export const getAuthenticatedUser = (user: SessionUser | null): SessionUser => {
  if (!user) {
    // In authenticated routes, this should never happen
    // If it does, it indicates a routing or session management issue
    console.error('User is null in authenticated route - this should not happen');
    throw new Error('Authentication required');
  }
  return user;
};
