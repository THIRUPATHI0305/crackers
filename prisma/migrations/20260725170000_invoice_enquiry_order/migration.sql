-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "enquiryId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "orderId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_enquiryId_key" ON "Invoice"("enquiryId");
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_orderId_key" ON "Invoice"("orderId");

DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
