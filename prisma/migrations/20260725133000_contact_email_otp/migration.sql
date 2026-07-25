-- AlterTable
ALTER TABLE "ContactMessage" ADD COLUMN "email" TEXT;

-- CreateIndex
CREATE INDEX "ContactMessage_email_idx" ON "ContactMessage"("email");
