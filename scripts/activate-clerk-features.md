# Post-Deployment Clerk Activation Script

## After Railway deployment completes, follow these steps to activate full Clerk functionality:

### 1. ✅ Verify Database Migration Success
Check that the database tables have been updated with:
- `User.clerkUserId` field (nullable string, unique)
- `Organisation.clerkOrganizationId` field (nullable string, unique)  
- `IdentityProvider.CLERK` enum value

### 2. 🔧 Activate Clerk User Creation Logic

**File: `packages/trpc/server/user-router/get-or-create-by-clerk-id.ts`**

Uncomment and activate the full implementation:

```typescript
// Remove the temporary implementation and activate:
import { IdentityProvider } from '@documenso/prisma/client';

// In the procedure, replace with full logic:
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
```

### 3. 🏢 Implement Clerk Organizations Integration

Create organization sync between Clerk Organizations and local Organisation table:

**File: `packages/trpc/server/organisation-router/sync-clerk-org.ts`**

```typescript
export const syncClerkOrganization = procedure
  .input(z.object({
    clerkOrgId: z.string(),
    name: z.string(),
    url: z.string(),
  }))
  .mutation(async ({ input }) => {
    const { clerkOrgId, name, url } = input;
    
    // Create or update local organization
    return await prisma.organisation.upsert({
      where: { clerkOrganizationId: clerkOrgId },
      update: { name },
      create: {
        id: alphaid(),
        clerkOrganizationId: clerkOrgId,
        name,
        url,
        type: OrganisationType.REGULAR,
      },
    });
  });
```

### 4. 🔒 Add Organization Access Control

Update `ClerkSessionProvider` to sync Clerk Organizations:

```typescript
// In refreshSession(), add organization sync:
const organisations = await Promise.all(
  userMemberships?.data?.map(async (membership) => {
    const clerkOrg = membership.organization;
    return await trpc.organisation.syncClerkOrg.mutate({
      clerkOrgId: clerkOrg.id,
      name: clerkOrg.name,
      url: clerkOrg.slug || clerkOrg.id,
    });
  }) || []
);
```

### 5. 🚀 Test Full Integration

1. **Sign up new user** - should create Clerk user + local user record
2. **Sign in existing user** - should link Clerk ID to existing user
3. **Create organization in Clerk** - should sync to local Organisation table
4. **Test organization switching** - should work with existing team structure
5. **Verify all existing features** - documents, templates, teams, etc.

### 6. 🧹 Clean Up (Optional)

After confirming everything works:
- Remove old NextAuth-related code
- Remove temporary comments and logging
- Update environment variable documentation

## 🎯 Success Criteria

- ✅ Users can sign in/up with Clerk
- ✅ Existing users can access their data
- ✅ Organizations sync between Clerk and local database
- ✅ All existing features work unchanged
- ✅ No data loss or corruption
- ✅ Performance is maintained or improved

## 🆘 Rollback Plan

If issues occur, rollback steps:
1. Revert to previous git commit
2. Redeploy on Railway
3. Database will remain compatible (fields are nullable)
