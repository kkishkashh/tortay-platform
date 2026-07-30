/*
  Warnings:

  - You are about to drop the column `reason` on the `section_deadline_changes` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ShiftReasonCategory" AS ENUM ('ПРАВКИ_ЗАКАЗЧИКА', 'ИЗМЕНЕНИЕ_ПРОГРАММЫ', 'НЕТ_ИСХОДНЫХ_ДАННЫХ', 'ЗАМЕЧАНИЯ_ЭКСПЕРТИЗЫ', 'СОГЛАСОВАНИЕ_ГОСОРГАНОВ', 'СМЕЖНИКИ_СУБПОДРЯД', 'ТВОРЧЕСКАЯ_ПРОРАБОТКА', 'ВНУТРЕННИЕ_ПРИЧИНЫ');

-- CreateEnum
CREATE TYPE "PulseSignal" AS ENUM ('ЗЕЛЁНЫЙ', 'ЖЁЛТЫЙ', 'КРАСНЫЙ');

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "usesPulseTracking" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "section_deadline_changes" DROP COLUMN "reason",
ADD COLUMN     "comment" TEXT,
ADD COLUMN     "reasonCategory" "ShiftReasonCategory";

-- CreateTable
CREATE TABLE "section_pulses" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "isoWeek" TEXT NOT NULL,
    "signal" "PulseSignal" NOT NULL,
    "note" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "section_pulses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "section_pulses_sectionId_idx" ON "section_pulses"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "section_pulses_sectionId_isoWeek_key" ON "section_pulses"("sectionId", "isoWeek");

-- AddForeignKey
ALTER TABLE "section_pulses" ADD CONSTRAINT "section_pulses_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_pulses" ADD CONSTRAINT "section_pulses_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
