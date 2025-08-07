import { z } from 'zod';

import { alphaid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { OrganisationType } from '@documenso/prisma/client';

import { procedure } from '../trpc';

const ZSyncClerkOrgSchema = z.object({
  clerkOrgId: z.string(),
  name: z.string(),
  url: z.string(),
});

export const syncClerkOrganization = procedure
  .input(ZSyncClerkOrgSchema)
  .mutation(async ({ input, ctx }) => {
    const { user } = ctx;
    const { clerkOrgId, name, url } = input;

    // Create or update local organization
    const organisation = await prisma.organisation.upsert({
      where: { clerkOrganizationId: clerkOrgId },
      update: { name },
      create: {
        id: alphaid(),
        clerkOrganizationId: clerkOrgId,
        name,
        url,
        type: OrganisationType.REGULAR,
        ownerUserId: user.id,
        organisationClaimId: alphaid(),
        organisationGlobalSettingsId: alphaid(),
      },
    });

    // Ensure the user is a member of this organization
    await prisma.organisationMember.upsert({
      where: {
        userId_organisationId: {
          userId: user.id,
          organisationId: organisation.id,
        },
      },
      update: {},
      create: {
        id: alphaid(),
        userId: user.id,
        organisationId: organisation.id,
      },
    });

    return organisation;
  });
