-- Явное назначение "Ведущий архитектор под конкретным руководителем"
-- (2026-08-06, по прямой просьбе) — раньше статус был чисто производным от
-- того, есть ли у человека подчинённые (reportsToId чужих записей). Теперь
-- это отдельное поле, назначаемое явно, независимо от размера команды.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "leadOfManagerId" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_leadOfManagerId_fkey" FOREIGN KEY ("leadOfManagerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: у кого уже есть хотя бы один подчинённый по старой производной
-- модели, и чей reportsToId указывает на руководителя департамента —
-- считались Ведущими архитекторами и до этой миграции, просто без явного
-- поля. Переносим их в explicit-поле, чтобы переход не "стёр" существующие
-- блоки задним числом.
UPDATE "users" AS lead
SET "leadOfManagerId" = lead."reportsToId"
WHERE lead."reportsToId" IN (SELECT "B" FROM "_DepartmentManagers")
  AND EXISTS (SELECT 1 FROM "users" AS report WHERE report."reportsToId" = lead."id");
