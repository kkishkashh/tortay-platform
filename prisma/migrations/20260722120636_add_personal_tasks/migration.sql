-- CreateTable
CREATE TABLE "personal_tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'НОВАЯ',
    "priority" "TaskPriority" NOT NULL DEFAULT 'СРЕДНИЙ',
    "deadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personal_tasks_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "personal_tasks" ADD CONSTRAINT "personal_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
