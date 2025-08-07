-- Add Clerk integration fields

-- AlterTable
ALTER TABLE "User" ADD COLUMN "clerkUserId" TEXT;

-- AlterTable  
ALTER TABLE "Organisation" ADD COLUMN "clerkOrganizationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_clerkOrganizationId_key" ON "Organisation"("clerkOrganizationId");
