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
