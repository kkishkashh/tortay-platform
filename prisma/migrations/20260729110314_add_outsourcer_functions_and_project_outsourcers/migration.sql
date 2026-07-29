-- CreateTable
CREATE TABLE "outsourcer_functions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outsourcer_functions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_outsourcers" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "outsourcerId" TEXT NOT NULL,
    "addedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contractNumber" TEXT,
    "contractDate" DATE,
    "projectSubject" TEXT,
    "durationDays" INTEGER,
    "totalAmount" DECIMAL(14,2),
    "paymentPercent1" INTEGER DEFAULT 60,
    "paymentPercent2" INTEGER DEFAULT 20,
    "paymentPercent3" INTEGER DEFAULT 20,
    "tranche1Paid" BOOLEAN NOT NULL DEFAULT false,
    "tranche2Paid" BOOLEAN NOT NULL DEFAULT false,
    "tranche3Paid" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "project_outsourcers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_OutsourcerToOutsourcerFunction" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_OutsourcerToOutsourcerFunction_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "outsourcer_functions_name_key" ON "outsourcer_functions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "project_outsourcers_contractNumber_key" ON "project_outsourcers"("contractNumber");

-- CreateIndex
CREATE UNIQUE INDEX "project_outsourcers_projectId_outsourcerId_key" ON "project_outsourcers"("projectId", "outsourcerId");

-- CreateIndex
CREATE INDEX "_OutsourcerToOutsourcerFunction_B_index" ON "_OutsourcerToOutsourcerFunction"("B");

-- AddForeignKey
ALTER TABLE "project_outsourcers" ADD CONSTRAINT "project_outsourcers_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_outsourcers" ADD CONSTRAINT "project_outsourcers_outsourcerId_fkey" FOREIGN KEY ("outsourcerId") REFERENCES "outsourcers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_outsourcers" ADD CONSTRAINT "project_outsourcers_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OutsourcerToOutsourcerFunction" ADD CONSTRAINT "_OutsourcerToOutsourcerFunction_A_fkey" FOREIGN KEY ("A") REFERENCES "outsourcers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OutsourcerToOutsourcerFunction" ADD CONSTRAINT "_OutsourcerToOutsourcerFunction_B_fkey" FOREIGN KEY ("B") REFERENCES "outsourcer_functions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
