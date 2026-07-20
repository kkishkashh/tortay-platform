-- Backfill existing rows with a placeholder before enforcing NOT NULL,
-- same convention as clientName elsewhere in this schema (see
-- createProjectAction) for retrofitted required fields with no UI to
-- edit them yet.
ALTER TABLE "outsourcers" ADD COLUMN "directorName" TEXT NOT NULL DEFAULT 'Не указано';
ALTER TABLE "outsourcers" ALTER COLUMN "directorName" DROP DEFAULT;

ALTER TABLE "outsourcers" DROP COLUMN "rate";
