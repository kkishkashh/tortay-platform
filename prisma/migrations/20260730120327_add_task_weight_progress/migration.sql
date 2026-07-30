/*
  Warnings:

  - You are about to drop the column `completionPercent` on the `sections` table. All rows currently have it at its default (0), unused anywhere in application code — safe to drop.

*/
-- AlterTable
ALTER TABLE "sections" DROP COLUMN "completionPercent";

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "weight" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "department_task_template_items" ADD COLUMN     "weight" INTEGER NOT NULL DEFAULT 1;
