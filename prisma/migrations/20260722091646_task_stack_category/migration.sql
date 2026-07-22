-- CreateEnum
CREATE TYPE "TaskStackCategory" AS ENUM ('БАЗОВЫЙ', 'НЕСТАНДАРТНЫЙ');

-- AlterTable
ALTER TABLE "department_task_template_items" ADD COLUMN     "category" "TaskStackCategory" NOT NULL DEFAULT 'БАЗОВЫЙ';
