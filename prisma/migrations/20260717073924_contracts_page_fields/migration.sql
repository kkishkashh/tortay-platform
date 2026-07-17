-- CreateEnum
CREATE TYPE "AvrStage" AS ENUM ('НЕТ', 'СТАДИЯ_1', 'СТАДИЯ_2', 'ФИНАЛЬНАЯ');

-- AlterEnum
ALTER TYPE "ContractStatus" ADD VALUE 'ОТМЕНЁН';

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "avrStage" "AvrStage" NOT NULL DEFAULT 'НЕТ',
ADD COLUMN     "clientName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "contracts_number_key" ON "contracts"("number");

