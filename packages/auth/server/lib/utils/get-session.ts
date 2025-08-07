import type { Session } from '@prisma/client';
import type { Context } from 'hono';

import { AppError } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { Role } from '@documenso/prisma/client';

import { AuthenticationErrorCode } from '../errors/error-codes';
import type { SessionUser, SessionValidationResult } from '../session/session';
import { validateSessionToken } from '../session/session';
import { getSessionCookie } from '../session/session-cookies';

export const getSession = async (c: Context | Request) => {
  const { session, user } = await getOptionalSession(mapRequestToContextForCookie(c));

  if (session && user) {
    return { session, user };
  }

  if (c instanceof Request) {
    throw new Error('Unauthorized');
  }

  throw new AppError(AuthenticationErrorCode.Unauthorized);
};

// Helper function to extract Clerk session from cookies
const getClerkSessionFromCookies = (req: Request): SessionValidationResult => {
  try {
    const cookies = req.headers.get('cookie');
    if (!cookies) {
      return { session: null, user: null, isAuthenticated: false };
    }

    // Look for __session cookie which contains the Clerk JWT
    const sessionMatch = cookies.match(/__session=([^;]+)/);
    if (!sessionMatch) {
      return { session: null, user: null, isAuthenticated: false };
    }

    try {
      // Decode JWT payload (second part of JWT)
      const jwtPayload = sessionMatch[1].split('.')[1];
      const decodedPayload = JSON.parse(atob(jwtPayload.replace(/-/g, '+').replace(/_/g, '/')));

      const clerkUserId = decodedPayload.sub;
      const clerkSessionId = decodedPayload.sid;

      if (!clerkUserId || !clerkSessionId) {
        return { session: null, user: null, isAuthenticated: false };
      }

      // Create a temporary session that works even without database migration
      const mockUser: SessionUser = {
        id: parseInt(clerkUserId.slice(-8), 16) || 1, // Convert part of Clerk ID to number
        name: 'Clerk User', // This will be populated by the frontend session provider
        email: 'temp@clerk.user', // This will be populated by the frontend session provider
        emailVerified: new Date(),
        avatarImageId: null,
        twoFactorEnabled: false,
        roles: [Role.USER],
        signature: null,
      };

      const mockSession: Session = {
        id: clerkSessionId,
        userId: mockUser.id,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
        ipAddress: null,
        userAgent: null,
        updatedAt: new Date(),
        sessionToken: clerkSessionId, // Use the Clerk session ID as the token
      };

      return { session: mockSession, user: mockUser, isAuthenticated: true };
    } catch (jwtError) {
      console.error('Session: Error decoding Clerk JWT:', jwtError);
      return { session: null, user: null, isAuthenticated: false };
    }
  } catch (error) {
    console.error('Session: Error getting Clerk session from cookies:', error);
    return { session: null, user: null, isAuthenticated: false };
  }
};

export const getOptionalSession = async (
  c: Context | Request,
): Promise<SessionValidationResult> => {
  // First try NextAuth session
  const sessionId = await getSessionCookie(mapRequestToContextForCookie(c));

  if (sessionId) {
    const nextAuthResult = await validateSessionToken(sessionId);
    if (nextAuthResult.session && nextAuthResult.user) {
      return nextAuthResult;
    }
  }

  // If no NextAuth session, try Clerk session from cookies
  const req = c instanceof Request ? c : c.req.raw;
  return getClerkSessionFromCookies(req);
};

export type ActiveSession = Omit<Session, 'sessionToken'>;

export const getActiveSessions = async (c: Context | Request): Promise<ActiveSession[]> => {
  const { user } = await getSession(c);

  return await prisma.session.findMany({
    where: {
      userId: user.id,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      updatedAt: true,
      createdAt: true,
      ipAddress: true,
      userAgent: true,
    },
  });
};

/**
 * Todo: (RR7) Rethink, this is pretty sketchy.
 */
const mapRequestToContextForCookie = (c: Context | Request) => {
  if (c instanceof Request) {
    const partialContext = {
      req: {
        raw: c,
      },
    };

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return partialContext as unknown as Context;
  }

  return c;
};
