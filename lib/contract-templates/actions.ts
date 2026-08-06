"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageContractTemplate } from "@/lib/contract-templates/permissions";

// Вызывается клиентом ПОСЛЕ успешной загрузки файла в Vercel Blob (см.
// change-template-dialog.tsx) — тот же приём, что и у
// updateAvatarAction/createTaskAttachmentAction: сам роут загрузки
// (app/api/uploads/contract-template) только выдаёт токен, в БД пишет
// эта серверная экшен. Новый шаблон становится единственным активным —
// старый не удаляется физически, просто снимается isActive (история
// остаётся, тот же принцип, что у Project.isArchived).
export async function setActiveContractTemplateAction(fileUrl: string, fileName: string) {
  const session = await auth();
  if (!session?.user || !canManageContractTemplate(session.user)) {
    throw new Error("Менять шаблон договора может только администратор или руководитель");
  }

  await prisma.$transaction(async (tx) => {
    await tx.contractTemplate.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
    await tx.contractTemplate.create({
      data: {
        fileUrl,
        fileName,
        uploadedByUserId: session.user.id,
        isActive: true,
      },
    });
  });

  revalidatePath("/contracts");
}
