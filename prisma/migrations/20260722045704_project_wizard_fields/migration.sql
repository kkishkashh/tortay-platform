-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "client" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "location" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "sections" ADD COLUMN     "contactManagerId" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "assignedByUserId" TEXT;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_contactManagerId_fkey" FOREIGN KEY ("contactManagerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
