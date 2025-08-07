import { z } from 'zod';

import { getHighestOrganisationRoleInGroup } from '@documenso/lib/utils/organisations';
import { buildTeamWhereQuery, getHighestTeamRoleInGroup } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure, procedure } from '../trpc';
import type { TGetOrganisationSessionResponse } from './get-organisation-session.types';
import { ZGetOrganisationSessionResponseSchema } from './get-organisation-session.types';

const ZGetOrganisationSessionUnauthenticatedSchema = z.object({
  clerkUserId: z.string(),
});

/**
 * Get all the organisations and teams a user belongs to (authenticated version).
 */
export const getOrganisationSessionRoute = authenticatedProcedure
  .output(ZGetOrganisationSessionResponseSchema)
  .query(async ({ ctx }) => {
    return await getOrganisationSession({ userId: ctx.user.id });
  });

/**
 * Get all the organisations and teams a user belongs to (unauthenticated version for session setup).
 */
export const getOrganisationSessionUnauthenticatedRoute = procedure
  .input(ZGetOrganisationSessionUnauthenticatedSchema)
  .output(ZGetOrganisationSessionResponseSchema)
  .query(async ({ input }) => {
    const { clerkUserId } = input;

    // Find the user by Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      console.log('getOrganisationSession: No user found for Clerk ID:', clerkUserId);
      return [];
    }

    return await getOrganisationSession({ userId: user.id });
  });

export const getOrganisationSession = async ({
  userId,
}: {
  userId: number;
}): Promise<TGetOrganisationSessionResponse> => {
  const organisations = await prisma.organisation.findMany({
    where: {
      members: {
        some: {
          userId,
        },
      },
    },
    include: {
      organisationClaim: true,
      subscription: true,
      groups: {
        where: {
          organisationGroupMembers: {
            some: {
              organisationMember: {
                userId,
              },
            },
          },
        },
      },
      teams: {
        where: buildTeamWhereQuery({ teamId: undefined, userId }),
        include: {
          teamGroups: {
            where: {
              organisationGroup: {
                organisationGroupMembers: {
                  some: {
                    organisationMember: {
                      userId,
                    },
                  },
                },
              },
            },
            include: {
              organisationGroup: true,
            },
          },
        },
      },
    },
  });

  return organisations.map((organisation) => {
    return {
      ...organisation,
      teams: organisation.teams.map((team) => ({
        ...team,
        currentTeamRole: getHighestTeamRoleInGroup(team.teamGroups),
      })),
      currentOrganisationRole: getHighestOrganisationRoleInGroup(organisation.groups),
    };
  });
};
