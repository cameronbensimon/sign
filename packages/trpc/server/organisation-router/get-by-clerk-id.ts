import { z } from 'zod';

import { authenticatedProcedure } from '../trpc';

export const getByClerkId = authenticatedProcedure
  .input(
    z.object({
      clerkOrganizationId: z.string(),
    }),
  )
  .query(async ({ input, ctx }) => {
    const { clerkOrganizationId } = input;
    const { prisma } = ctx;

    const organisation = await prisma.organisation.findFirst({
      where: {
        clerkOrganizationId,
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                clerkUserId: true,
              },
            },
          },
        },
        teams: {
          select: {
            id: true,
            name: true,
            url: true,
          },
        },
      },
    });

    if (!organisation) {
      throw new Error('Organisation not found');
    }

    return organisation;
  });
