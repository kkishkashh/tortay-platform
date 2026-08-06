-- "Создан просроченным" (см. schema.prisma комментарий у Project) — оба
-- поля nullable, ничего не меняется для существующих проектов.
ALTER TABLE "projects" ADD COLUMN "overdueReason" TEXT;
ALTER TABLE "projects" ADD COLUMN "finalDeadline" TIMESTAMP(3);
