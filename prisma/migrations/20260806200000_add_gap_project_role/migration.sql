-- Добавляет ГАП (Главный архитектор проекта) в ProjectRole — см.
-- schema.prisma комментарий у enum ProjectRole.
ALTER TYPE "ProjectRole" ADD VALUE 'ГАП';
