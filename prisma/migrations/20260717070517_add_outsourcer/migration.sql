-- CreateTable
CREATE TABLE "outsourcers" (
    "id" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "specialization" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "contractNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outsourcers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outsourcers_contractNumber_key" ON "outsourcers"("contractNumber");
