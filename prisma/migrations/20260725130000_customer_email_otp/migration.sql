-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- AlterTable
ALTER TABLE "OtpChallenge" ADD COLUMN "email" TEXT;

-- CreateIndex
CREATE INDEX "OtpChallenge_email_purpose_idx" ON "OtpChallenge"("email", "purpose");
