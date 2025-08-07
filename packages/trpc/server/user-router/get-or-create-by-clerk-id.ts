import { z } from 'zod';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';

// Temporarily comment out until migration is deployed
// import { IdentityProvider } from '@documenso/prisma/client';
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

    // Temporarily return a simple response until migration is deployed
    // This will be activated once the clerkUserId field is available in the database

    // Find user by email for now
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (user) {
      return user;
    }

    // Create a new user without Clerk fields for now
    return await prisma.user.create({
      data: {
        email,
        name: name || null,
        emailVerified: new Date(), // Clerk handles email verification
        // identityProvider: IdentityProvider.CLERK, // Will be enabled after migration
        source: `Clerk - ${NEXT_PUBLIC_WEBAPP_URL()}`,
      },
    });
  });
