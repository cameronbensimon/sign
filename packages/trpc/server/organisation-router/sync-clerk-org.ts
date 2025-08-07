import { z } from 'zod';

import { ORGANISATION_INTERNAL_GROUPS } from '@documenso/lib/constants/organisations';
import { prefixedId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { OrganisationMemberRole, OrganisationType, TeamMemberRole } from '@documenso/prisma/client';

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
      // Update the organisation name
      const updatedOrg = await tx.organisation.update({
        where: { clerkOrganizationId: clerkOrgId },
        data: { name },
      });

      // Ensure internal organisation groups exist
      const existingGroups = await tx.organisationGroup.findMany({
        where: { organisationId: updatedOrg.id },
        select: { id: true, organisationRole: true, type: true },
      });

      const missingGroups = ORGANISATION_INTERNAL_GROUPS.filter(
        (g) =>
          !existingGroups.some(
            (eg) => eg.type === g.type && eg.organisationRole === g.organisationRole,
          ),
      );

      if (missingGroups.length > 0) {
        await tx.organisationGroup.createMany({
          data: missingGroups.map((g) => ({
            id: prefixedId('org_group'),
            organisationId: updatedOrg.id,
            type: g.type,
            organisationRole: g.organisationRole,
          })),
        });
      }

      return updatedOrg;
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
        groups: {
          create: ORGANISATION_INTERNAL_GROUPS.map((g) => ({
            id: prefixedId('org_group'),
            type: g.type,
            organisationRole: g.organisationRole,
          })),
        },
      },
    });
  });

  // Ensure the user is a member of this organization
  const orgMember = await prisma.organisationMember.upsert({
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

  // Ensure the user is assigned to the organisation Admin group (enables team visibility)
  const adminGroup = await prisma.organisationGroup.findFirst({
    where: {
      organisationId: organisation.id,
      organisationRole: OrganisationMemberRole.ADMIN,
    },
    select: { id: true },
  });

  if (adminGroup) {
    const existingGroupMembership = await prisma.organisationGroupMember.findFirst({
      where: {
        groupId: adminGroup.id,
        organisationMemberId: orgMember.id,
      },
      select: { id: true },
    });

    if (!existingGroupMembership) {
      await prisma.organisationGroupMember.create({
        data: {
          id: prefixedId('group_member'),
          groupId: adminGroup.id,
          organisationMemberId: orgMember.id,
        },
      });
    }
  }

  // Ensure teams in this organisation are linked to the internal organisation groups
  const internalOrgGroups = await prisma.organisationGroup.findMany({
    where: { organisationId: organisation.id },
    select: { id: true, organisationRole: true },
  });

  const teams = await prisma.team.findMany({
    where: { organisationId: organisation.id },
    select: { id: true },
  });

  for (const team of teams) {
    for (const group of internalOrgGroups) {
      const existingTeamGroup = await prisma.teamGroup.findFirst({
        where: {
          teamId: team.id,
          organisationGroupId: group.id,
        },
        select: { id: true },
      });

      if (!existingTeamGroup) {
        await prisma.teamGroup.create({
          data: {
            id: prefixedId('team_group'),
            teamId: team.id,
            organisationGroupId: group.id,
            teamRole:
              group.organisationRole === OrganisationMemberRole.MEMBER
                ? TeamMemberRole.MEMBER
                : TeamMemberRole.ADMIN,
          },
        });
      }
    }
  }

  return organisation;
}
