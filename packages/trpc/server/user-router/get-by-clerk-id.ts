import { z } from 'zod';

import { authenticatedProcedure } from '../trpc';

export const getByClerkId = authenticatedProcedure
  .input(
    z.object({
      clerkUserId: z.string(),
    }),
  )
  .query(async ({ input, ctx }) => {
    const { clerkUserId } = input;
    const { prisma } = ctx;

    const user = await prisma.user.findFirst({
      where: {
        clerkUserId,
      },
      include: {
        organisationMember: {
          include: {
            organisation: {
              select: {
                id: true,
                name: true,
                url: true,
                clerkOrganizationId: true,
                type: true,
                avatarImageId: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Format organizations with role information
    const organisations = user.organisationMember.map((member) => ({
      ...member.organisation,
      role: 'MEMBER', // TODO: Get actual role from organization groups
    }));

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      clerkUserId: user.clerkUserId,
      avatarImageId: user.avatarImageId,
      signature: user.signature,
      roles: user.roles,
      disabled: user.disabled,
      organisations,
    };
  });
