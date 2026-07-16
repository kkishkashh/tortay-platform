"use server";

import { revalidatePath } from "next/cache";
import { ProjectRole } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SECTION_TEMPLATES, sectionTemplateName } from "@/lib/projects/section-templates";

// Создать проект может любой авторизованный сотрудник. ГИП — это
// отдельный человек, которого создатель выбирает из списка (не
// обязательно он сам). Создатель ВСЕГДА получает запись в ProjectMember:
// если он выбрал сам себя ГИПом — одна запись с ролью ГИП; если выбрал
// кого-то другого — выбранный получает роль ГИП, а создатель отдельно
// становится МЕНЕДЖЕРОМ (это нужно, например, чтобы было на кого
// сослаться как на автора договора — см. createdByMemberId ниже).
export async function createProjectAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const name = (formData.get("name") as string | null)?.trim();
  if (!name) {
    throw new Error("Название проекта обязательно");
  }

  const gipUserId = formData.get("gipUserId") as string | null;
  if (!gipUserId) {
    throw new Error("Нужно выбрать ГИП");
  }

  const selectedCodes = formData.getAll("sectionTemplates") as string[];
  // Порядок разделов — по каноническому списку шаблонов, а не по
  // порядку кликов пользователя (иначе Гантт будет выглядеть хаотично).
  const orderedTemplates = SECTION_TEMPLATES.filter((template) =>
    selectedCodes.includes(template.code),
  );

  const totalAmountRaw = (formData.get("totalAmount") as string | null)?.trim();
  let totalAmount: number | null = null;
  if (totalAmountRaw) {
    totalAmount = Number(totalAmountRaw);
    if (Number.isNaN(totalAmount) || totalAmount <= 0) {
      throw new Error("Некорректная стоимость договора");
    }
  }

  const creatorIsGip = gipUserId === session.user.id;

  await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({ data: { name } });

    const gipMember = await tx.projectMember.create({
      data: {
        projectId: project.id,
        userId: gipUserId,
        projectRole: ProjectRole.ГИП,
      },
    });

    const creatorMember = creatorIsGip
      ? gipMember
      : await tx.projectMember.create({
          data: {
            projectId: project.id,
            userId: session.user.id,
            projectRole: ProjectRole.МЕНЕДЖЕР,
          },
        });

    if (orderedTemplates.length > 0) {
      await tx.section.createMany({
        data: orderedTemplates.map((template, index) => ({
          projectId: project.id,
          name: sectionTemplateName(template.code, template.label),
          orderIndex: index,
        })),
      });
    }

    if (totalAmount !== null) {
      await tx.contract.create({
        data: {
          projectId: project.id,
          createdByMemberId: creatorMember.id,
          totalAmount,
        },
      });
    }
  });

  revalidatePath("/projects");
}
