-- AlterTable
ALTER TABLE "Bill" ADD COLUMN     "recurringTemplateId" TEXT;

-- CreateTable
CREATE TABLE "BillTemplate" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paymentDayOfMonth" INTEGER NOT NULL,
    "memo" TEXT,
    "glCategory" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "BillTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillTemplateLineItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,

    CONSTRAINT "BillTemplateLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillTemplate_cancelledAt_paymentDayOfMonth_idx" ON "BillTemplate"("cancelledAt", "paymentDayOfMonth");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_recurringTemplateId_dueDate_key" ON "Bill"("recurringTemplateId", "dueDate");

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_recurringTemplateId_fkey" FOREIGN KEY ("recurringTemplateId") REFERENCES "BillTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillTemplate" ADD CONSTRAINT "BillTemplate_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillTemplateLineItem" ADD CONSTRAINT "BillTemplateLineItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "BillTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

