-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ЛИД_НАЗНАЧЕН';
ALTER TYPE "NotificationType" ADD VALUE 'ЛИД_СНЯТ';

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "allowsLeadRole" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "reportsToId" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_reportsToId_fkey" FOREIGN KEY ("reportsToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
