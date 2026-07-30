-- CreateTable
CREATE TABLE "section_deadline_changes" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "previousDeadline" TIMESTAMP(3),
    "newDeadline" TIMESTAMP(3),
    "reason" TEXT,
    "changedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "section_deadline_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "section_deadline_changes_sectionId_idx" ON "section_deadline_changes"("sectionId");

-- AddForeignKey
ALTER TABLE "section_deadline_changes" ADD CONSTRAINT "section_deadline_changes_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_deadline_changes" ADD CONSTRAINT "section_deadline_changes_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
