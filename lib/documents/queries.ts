import { prisma } from "@/lib/prisma";

export type TaskAttachmentItem = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  uploadedAt: Date;
  uploader: { id: string; fullName: string };
};

export async function getDocumentsForTask(taskId: string): Promise<TaskAttachmentItem[]> {
  const documents = await prisma.document.findMany({
    where: { taskId },
    include: { uploader: { select: { id: true, fullName: true } } },
    orderBy: { uploadedAt: "asc" },
  });

  return documents.map((doc) => ({
    id: doc.id,
    fileName: doc.fileName,
    fileUrl: doc.fileUrl,
    fileSize: doc.fileSize,
    uploadedAt: doc.uploadedAt,
    uploader: doc.uploader,
  }));
}

// Пакетная версия getDocumentsForTask — см. комментарий у
// getCommentsForTasksBatch в lib/comments/queries.ts, тот же приём.
export async function getDocumentsForTasksBatch(
  taskIds: string[],
): Promise<Map<string, TaskAttachmentItem[]>> {
  const map = new Map<string, TaskAttachmentItem[]>();
  if (taskIds.length === 0) return map;

  const documents = await prisma.document.findMany({
    where: { taskId: { in: taskIds } },
    include: { uploader: { select: { id: true, fullName: true } } },
    orderBy: { uploadedAt: "asc" },
  });

  for (const doc of documents) {
    if (!doc.taskId) continue;
    const list = map.get(doc.taskId) ?? [];
    list.push({
      id: doc.id,
      fileName: doc.fileName,
      fileUrl: doc.fileUrl,
      fileSize: doc.fileSize,
      uploadedAt: doc.uploadedAt,
      uploader: doc.uploader,
    });
    map.set(doc.taskId, list);
  }
  return map;
}
