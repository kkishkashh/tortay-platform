import { TaskPriority, TaskStatus } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type PersonalTaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: Date | null;
  createdAt: Date;
};

// Выполненные — вниз списка, остальные — по сроку (без срока — в конце),
// внутри одного срока — сначала созданные раньше. Чисто на клиенте после
// выборки: датасет одного человека небольшой, условная сортировка в SQL
// того не стоит.
export async function getMyPersonalTasks(): Promise<PersonalTaskItem[]> {
  const session = await auth();
  if (!session?.user) return [];

  const tasks = await prisma.personalTask.findMany({
    where: { userId: session.user.id },
  });

  return tasks.sort((a, b) => {
    const aDone = a.status === TaskStatus.ВЫПОЛНЕНО;
    const bDone = b.status === TaskStatus.ВЫПОЛНЕНО;
    if (aDone !== bDone) return aDone ? 1 : -1;

    if (a.deadline && b.deadline) return a.deadline.getTime() - b.deadline.getTime();
    if (a.deadline) return -1;
    if (b.deadline) return 1;

    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}
