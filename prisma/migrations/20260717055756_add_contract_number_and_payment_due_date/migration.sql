-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "number" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "dueDate" TIMESTAMP(3);
