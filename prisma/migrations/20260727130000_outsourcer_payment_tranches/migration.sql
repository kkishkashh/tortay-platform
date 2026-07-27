-- AlterTable
ALTER TABLE "outsourcers" DROP COLUMN "advancePercent",
ADD COLUMN     "paymentPercent1" INTEGER DEFAULT 60,
ADD COLUMN     "paymentPercent2" INTEGER DEFAULT 20,
ADD COLUMN     "paymentPercent3" INTEGER DEFAULT 20;
