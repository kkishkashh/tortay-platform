-- Точечный доступ "видеть/управлять любым проектом" (см. schema.prisma
-- комментарий у User.allProjectsAccess) — nullable по умолчанию false,
-- ничего не меняет для существующих пользователей.
ALTER TABLE "users" ADD COLUMN "allProjectsAccess" BOOLEAN NOT NULL DEFAULT false;
