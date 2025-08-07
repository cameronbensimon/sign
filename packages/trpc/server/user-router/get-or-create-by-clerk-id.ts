import { z } from 'zod';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import { IdentityProvider } from '@documenso/prisma/client';

import { procedure } from '../trpc';

export const ZGetOrCreateByClerkIdRequestSchema = z.object({
  clerkUserId: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
});

export type TGetOrCreateByClerkIdRequest = z.infer<typeof ZGetOrCreateByClerkIdRequestSchema>;

export const getOrCreateByClerkId = procedure
  .input(ZGetOrCreateByClerkIdRequestSchema)
  .query(async ({ input }) => {
    const { clerkUserId, email, name } = input;

    // First try to find an existing user by Clerk ID
    let user = await prisma.user.findUnique({
      where: {
        clerkUserId,
      },
    });

    if (user) {
      return user;
    }

    // If not found by Clerk ID, try to find by email and update with Clerk ID
    user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (user) {
      // Update existing user with Clerk ID
      return await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          clerkUserId,
        },
      });
    }

    // Create a new user
    return await prisma.user.create({
      data: {
        clerkUserId,
        email,
        name: name || null,
        emailVerified: new Date(), // Clerk handles email verification
        identityProvider: IdentityProvider.CLERK,
        source: `Clerk - ${NEXT_PUBLIC_WEBAPP_URL()}`,
      },
    });
  });
