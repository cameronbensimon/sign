import { z } from 'zod';

import { prefixedId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { OrganisationType } from '@documenso/prisma/client';

import { authenticatedProcedure, procedure } from '../trpc';

const ZSyncClerkOrgSchema = z.object({
  clerkOrgId: z.string(),
  name: z.string(),
  url: z.string(),
});

const ZSyncClerkOrgWithUserSchema = z.object({
  clerkOrgId: z.string(),
  name: z.string(),
  url: z.string(),
  clerkUserId: z.string(),
});

// Unauthenticated version for initial session setup
export const syncClerkOrganizationUnauthenticated = procedure
  .input(ZSyncClerkOrgWithUserSchema)
  .mutation(async ({ input }) => {
    const { clerkOrgId, name, url, clerkUserId } = input;

    // Find the user by Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      throw new Error(`User not found for Clerk ID: ${clerkUserId}`);
    }

    return await syncOrganizationInternal({ clerkOrgId, name, url, userId: user.id });
  });

// Authenticated version for regular updates
export const syncClerkOrganization = authenticatedProcedure
  .input(ZSyncClerkOrgSchema)
  .mutation(async ({ input, ctx }) => {
    const { user } = ctx;
    const { clerkOrgId, name, url } = input;

    return await syncOrganizationInternal({ clerkOrgId, name, url, userId: user.id });
  });

// Shared internal logic
async function syncOrganizationInternal({
  clerkOrgId,
  name,
  url,
  userId,
}: {
  clerkOrgId: string;
  name: string;
  url: string;
  userId: number;
}) {
  // Create or update local organization with proper dependencies
  const organisation = await prisma.$transaction(async (tx) => {
    // Check if organization already exists
    const existingOrg = await tx.organisation.findUnique({
      where: { clerkOrganizationId: clerkOrgId },
    });

    if (existingOrg) {
      // Just update the name if organization exists
      return await tx.organisation.update({
        where: { clerkOrganizationId: clerkOrgId },
        data: { name },
      });
    }

    // Create new organization with all required dependencies
    const organisationGlobalSettings = await tx.organisationGlobalSettings.create({
      data: {
        id: prefixedId('org_setting'),
        documentVisibility: 'EVERYONE',
        documentLanguage: 'en',
        includeSenderDetails: true,
        includeSigningCertificate: true,
        typedSignatureEnabled: true,
        uploadSignatureEnabled: true,
        drawSignatureEnabled: true,
        brandingEnabled: false,
        brandingLogo: '',
        brandingUrl: '',
        brandingCompanyDetails: '',
        emailDocumentSettings: {
          recipientSigningRequest: true,
          recipientRemoved: true,
          recipientSigned: true,
          documentPending: true,
          documentCompleted: true,
          documentDeleted: true,
          ownerDocumentCompleted: true,
        },
      },
    });

    const organisationClaim = await tx.organisationClaim.create({
      data: {
        id: prefixedId('org_claim'),
        originalSubscriptionClaimId: 'free',
        teamCount: 1,
        memberCount: 1,
        flags: {},
      },
    });

    const orgId = prefixedId('org');

    return await tx.organisation.create({
      data: {
        id: orgId,
        clerkOrganizationId: clerkOrgId,
        name,
        url: url || orgId,
        type: OrganisationType.ORGANISATION,
        ownerUserId: userId,
        organisationClaimId: organisationClaim.id,
        organisationGlobalSettingsId: organisationGlobalSettings.id,
      },
    });
  });

  // Ensure the user is a member of this organization
  await prisma.organisationMember.upsert({
    where: {
      userId_organisationId: {
        userId: userId,
        organisationId: organisation.id,
      },
    },
    update: {},
    create: {
      id: prefixedId('org_member'),
      userId: userId,
      organisationId: organisation.id,
    },
  });

  return organisation;
}
