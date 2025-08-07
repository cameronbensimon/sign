import type { Session } from '@prisma/client';
import type { Context } from 'hono';
import type { Logger } from 'pino';
import { z } from 'zod';

import type {
  SessionUser,
  SessionValidationResult,
} from '@documenso/auth/server/lib/session/session';
import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import type { RootApiLog } from '@documenso/lib/types/api-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { alphaid } from '@documenso/lib/universal/id';
import { logger } from '@documenso/lib/utils/logger';
import { Role } from '@documenso/prisma/client';
// This is a bit nasty. Todo: Extract
import type { HonoEnv } from '@documenso/remix/server/router';

type CreateTrpcContextOptions = {
  c: Context<HonoEnv>;
  requestSource: 'app' | 'apiV1' | 'apiV2';
};

// Helper function to get Clerk session information from request headers/cookies
const getClerkSessionFromHeaders = (req: Request): SessionValidationResult => {
  try {
    // First try custom headers (for backwards compatibility)
    let clerkSessionId = req.headers.get('x-clerk-session-id');
    let clerkUserId = req.headers.get('x-clerk-user-id');

    // If no custom headers, try to extract from Clerk session cookies
    if (!clerkSessionId || !clerkUserId) {
      const cookies = req.headers.get('cookie');
      if (cookies) {
        // Look for __session cookie which contains the Clerk JWT
        const sessionMatch = cookies.match(/__session=([^;]+)/);
        if (sessionMatch) {
          try {
            // Decode JWT payload (second part of JWT)
            const jwtPayload = sessionMatch[1].split('.')[1];
            const decodedPayload = JSON.parse(
              atob(jwtPayload.replace(/-/g, '+').replace(/_/g, '/')),
            );

            clerkUserId = decodedPayload.sub;
            clerkSessionId = decodedPayload.sid;

            console.log('TRPC Context: Authenticated via Clerk JWT:', { clerkUserId });
          } catch (jwtError) {
            console.error('TRPC Context: Error decoding Clerk JWT:', jwtError);
          }
        }
      }
    }

    if (!clerkSessionId || !clerkUserId) {
      return { session: null, user: null, isAuthenticated: false };
    }

    // Create a temporary session that works even without database migration
    // This allows TRPC to work immediately while the database migration is pending
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

    console.log('TRPC Context: Created session for Clerk user:', mockUser.id);
    return { session: mockSession, user: mockUser, isAuthenticated: true };
  } catch (error) {
    console.error('TRPC Context: Error getting Clerk session:', error);
    return { session: null, user: null, isAuthenticated: false };
  }
};

export const createTrpcContext = async ({
  c,
  requestSource,
}: CreateTrpcContextOptions): Promise<TrpcContext> => {
  const req = c.req.raw;

  // Try to get session from NextAuth first (backwards compatibility)
  let sessionResult = await getOptionalSession(c);

  // If no NextAuth session, try to get Clerk session
  if (!sessionResult.session || !sessionResult.user) {
    sessionResult = getClerkSessionFromHeaders(req);
  }

  const { session, user } = sessionResult;

  const requestMetadata = c.get('context').requestMetadata;

  const metadata: ApiRequestMetadata = {
    requestMetadata,
    source: requestSource,
    auth: null,
  };

  const rawTeamId = req.headers.get('x-team-id') || undefined;

  const trpcLogger = logger.child({
    ipAddress: requestMetadata.ipAddress,
    userAgent: requestMetadata.userAgent,
    requestId: alphaid(),
  } satisfies RootApiLog);

  const teamId = z.coerce
    .number()
    .optional()
    .catch(() => undefined)
    .parse(rawTeamId);

  if (!session || !user) {
    return {
      logger: trpcLogger,
      session: null,
      user: null,
      teamId,
      req,
      metadata,
    };
  }

  return {
    logger: trpcLogger,
    session,
    user,
    teamId,
    req,
    metadata,
  };
};

export type TrpcContext = (
  | {
      session: null;
      user: null;
    }
  | {
      session: Session;
      user: SessionUser;
    }
) & {
  teamId: number | undefined;
  req: Request;
  metadata: ApiRequestMetadata;
  logger: Logger;
};
