-- Убирает значение ГАП из enum ProjectRole (роль полностью упразднена,
-- 2026-08-06, по прямой просьбе — ГАП = обычный руководитель/соруководитель
-- Архитектуры, отдельной роли больше нет). Postgres не поддерживает DROP
-- VALUE для enum напрямую, поэтому тип пересоздаётся без ГАП.
-- Единственная запись ProjectMember, ранее использовавшая ГАП, уже
-- переведена на МЕНЕДЖЕР вручную перед этой миграцией.
ALTER TYPE "ProjectRole" RENAME TO "ProjectRole_old";

CREATE TYPE "ProjectRole" AS ENUM ('ГИП', 'МЕНЕДЖЕР', 'ИНЖЕНЕР', 'ПОМОЩНИК_ГИП', 'ВЕДУЩИЙ_СПЕЦИАЛИСТ');

ALTER TABLE "project_members"
  ALTER COLUMN "projectRole" TYPE "ProjectRole"
  USING ("projectRole"::text::"ProjectRole");

DROP TYPE "ProjectRole_old";
