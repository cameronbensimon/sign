/*
  Usage:
    npm run with:env -- npx tsx scripts/check-clerk-orgs.ts <clerkUserId>
*/
import { prisma } from '@documenso/prisma';

async function main() {
  const clerkUserId = process.argv[2];
  if (!clerkUserId) {
    console.error('Usage: tsx scripts/check-clerk-orgs.ts <clerkUserId>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { clerkUserId } });
  if (!user) {
    console.log('No local user found for Clerk ID:', clerkUserId);
    return;
  }

  const organisations = await prisma.organisation.findMany({
    where: {
      members: { some: { userId: user.id } },
    },
    include: {
      teams: {
        include: {
          teamGroups: true,
        },
      },
      groups: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log('User:', { id: user.id, email: user.email, clerkUserId });
  console.log('Organisations count:', organisations.length);
  for (const org of organisations) {
    console.log('Org:', {
      id: org.id,
      name: org.name,
      url: org.url,
      clerkOrganizationId: org.clerkOrganizationId,
    });
    console.log('  Groups:', org.groups.map((g) => `${g.type}:${g.organisationRole}`).join(', '));
    console.log('  Teams:', org.teams.map((t) => `${t.id}:${t.url}`).join(', ') || '(none)');
  }
}

main().finally(async () => {
  await prisma.$disconnect();
});
