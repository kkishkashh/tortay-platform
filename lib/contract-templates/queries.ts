import { prisma } from "@/lib/prisma";

export type ContractTemplateInfo = {
  id: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: Date;
  uploadedByName: string;
};

// В любой момент активен максимум один шаблон (см. setActiveContractTemplateAction) —
// поэтому findFirst, а не findMany.
export async function getActiveContractTemplate(): Promise<ContractTemplateInfo | null> {
  const template = await prisma.contractTemplate.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      createdAt: true,
      uploadedByUser: { select: { fullName: true } },
    },
  });
  if (!template) return null;

  return {
    id: template.id,
    fileName: template.fileName,
    fileUrl: template.fileUrl,
    uploadedAt: template.createdAt,
    uploadedByName: template.uploadedByUser.fullName,
  };
}
