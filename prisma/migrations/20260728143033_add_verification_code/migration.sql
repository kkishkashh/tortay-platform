-- AlterTable
ALTER TABLE "users" ADD COLUMN     "verificationCode" TEXT,
ADD COLUMN     "verificationCodeExpiresAt" TIMESTAMP(3);
