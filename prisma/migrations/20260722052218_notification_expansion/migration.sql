-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'СОТРУДНИК_СОЗДАН';
ALTER TYPE "NotificationType" ADD VALUE 'ДЕПАРТАМЕНТ_НАЗНАЧЕН';
ALTER TYPE "NotificationType" ADD VALUE 'УЧАСТНИК_ПРОЕКТА_ДОБАВЛЕН';
ALTER TYPE "NotificationType" ADD VALUE 'ГИП_НАЗНАЧЕН';
ALTER TYPE "NotificationType" ADD VALUE 'СРОК_ИЗМЕНЁН';
ALTER TYPE "NotificationType" ADD VALUE 'ЗАДАЧА_ВОЗВРАЩЕНА';
ALTER TYPE "NotificationType" ADD VALUE 'ЗАДАЧА_ОДОБРЕНА';
