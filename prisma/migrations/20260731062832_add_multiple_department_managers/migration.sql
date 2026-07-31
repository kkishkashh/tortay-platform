-- Department.managerId (single manager) -> Department.managers (many-to-many),
-- по запросу Камилы 2026-07-31: у департамента может быть несколько
-- руководителей одновременно. Данные из managerId переносятся в join-таблицу
-- ДО удаления самой колонки, чтобы не потерять существующие назначения.

-- CreateTable
CREATE TABLE "_DepartmentManagers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DepartmentManagers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_DepartmentManagers_B_index" ON "_DepartmentManagers"("B");

-- Перенос существующих назначений managerId -> _DepartmentManagers, пока
-- колонка ещё существует.
INSERT INTO "_DepartmentManagers" ("A", "B")
SELECT "id", "managerId" FROM "departments" WHERE "managerId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "_DepartmentManagers" ADD CONSTRAINT "_DepartmentManagers_A_fkey" FOREIGN KEY ("A") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DepartmentManagers" ADD CONSTRAINT "_DepartmentManagers_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "departments" DROP CONSTRAINT "departments_managerId_fkey";

-- AlterTable
ALTER TABLE "departments" DROP COLUMN "managerId";
