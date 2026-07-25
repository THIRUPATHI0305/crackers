-- AlterTable
ALTER TABLE "OtpChallenge" ADD COLUMN IF NOT EXISTS "providerLogId" TEXT;
ALTER TABLE "OtpChallenge" ADD COLUMN IF NOT EXISTS "provider" TEXT;
