"use server";

import { revalidatePath } from "next/cache";
import { PaymentType, ProjectRole, ProjectStatus, SectionStatus } from "@prisma/client";

import { auth } from "@/auth";
import { logActivity } from "@/lib/activity/log";
import { prisma } from "@/lib/prisma";
import { canManageOperations } from "@/lib/projects/permissions";
import { SECTION_TEMPLATES, sectionTemplateName } from "@/lib/projects/section-templates";
import { PROJECT_STATUS_LABELS } from "@/lib/projects/status-labels";

// Делим сумму договора на 3 фиксированных транша по стандартной для
// инженерных договоров схеме 40/40/20 (было 33/33/34) — остаток
// округления уходит в последний транш, чтобы сумма трёх платежей всегда
// точно совпадала с totalAmount до тыина. Точные суммы можно
// скорректировать вручную после создания — см. updatePaymentAmountAction
// в lib/contracts/actions.ts.
function splitIntoTranches(totalAmount: number): [number, number, number] {
  const round2 = (value: number) => Math.round(value * 100) / 100;
  const avans = round2(totalAmount * 0.4);
  const tranche2 = round2(totalAmount * 0.4);
  const tranche3 = round2(totalAmount - avans - tranche2);
  return [avans, tranche2, tranche3];
}

// Создать проект может только РУКОВОДИТЕЛЬ — операционная часть
// (см. canManageOperations). ГИП — это отдельный человек, которого
// создатель выбирает из списка (не обязательно он сам). Создатель
// ВСЕГДА получает запись в ProjectMember: если он выбрал сам себя ГИПом
// — одна запись с ролью ГИП; если выбрал кого-то другого — выбранный
// получает роль ГИП, а создатель отдельно становится МЕНЕДЖЕРОМ (это
// нужно, например, чтобы было на кого сослаться как на автора договора
// — см. createdByMemberId ниже).
export async function createProjectAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  if (!canManageOperations(session.user)) {
    throw new Error("Создавать проекты может только руководитель");
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
      // Номер и клиент здесь не собираются в этой форме (быстрый мастер
      // проекта) — заполняем разумной заглушкой; оба поля можно
      // отредактировать позже через договор на /contracts.
      const year = new Date().getFullYear();
      const countThisYear = await tx.contract.count({
        where: { createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
      });
      const contract = await tx.contract.create({
        data: {
          projectId: project.id,
          createdByMemberId: creatorMember.id,
          number: `ДОГ-${year}-${String(countThisYear + 1).padStart(3, "0")}`,
          clientName: "Не указан",
          totalAmount,
        },
      });

      const [avans, tranche2, tranche3] = splitIntoTranches(totalAmount);
      await tx.payment.createMany({
        data: [
          { contractId: contract.id, paymentType: PaymentType.АВАНС, amount: avans },
          { contractId: contract.id, paymentType: PaymentType.ТРАНШ_2, amount: tranche2 },
          { contractId: contract.id, paymentType: PaymentType.ТРАНШ_3, amount: tranche3 },
        ],
      });
    }
  });

  revalidatePath("/projects");
  revalidatePath("/");
}

// completedAt фиксирует момент закрытия проекта — нужен для статистики
// "завершено в этом году" на дашборде (одного статуса недостаточно,
// т.к. переход мог произойти в любой момент, см. lib/dashboard/queries.ts).
// Если статус уводят обратно из ЗАВЕРШЁН_ПОЛНОСТЬЮ (например, закрыли по
// ошибке), completedAt сбрасывается — проект больше не "завершён".
export async function updateProjectStatusAction(
  projectId: string,
  status: ProjectStatus,
) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  if (!canManageOperations(session.user)) {
    throw new Error("Менять статус проекта может только руководитель");
  }

  await prisma.$transaction(async (tx) => {
    const project = await tx.project.update({
      where: { id: projectId },
      data: {
        status,
        completedAt: status === ProjectStatus.ЗАВЕРШЁН_ПОЛНОСТЬЮ ? new Date() : null,
      },
    });

    await logActivity(tx, {
      projectId,
      actorId: session.user.id,
      message: `${session.user.name} изменил статус проекта «${project.name}» на «${PROJECT_STATUS_LABELS[status]}»`,
    });
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
}

// Раздел отмечает руководитель (та же операционная зона ответственности,
// что и статус всего проекта), а не система сама — поэтому пишем событие
// в ленту с формулировкой "кто и что сделал", как в примере из брифа
// ("Ахметов Д. отметил раздел АР как выполненный").
export async function updateSectionStatusAction(
  sectionId: string,
  status: SectionStatus,
) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!section) {
    throw new Error("Раздел не найден");
  }

  if (!canManageOperations(session.user)) {
    throw new Error("Менять статус раздела может только руководитель");
  }

  const message =
    status === SectionStatus.ВЫПОЛНЕНО
      ? `${session.user.name} отметил раздел «${section.name}» как выполненный по проекту «${section.project.name}»`
      : `${session.user.name} вернул раздел «${section.name}» в работу по проекту «${section.project.name}»`;

  await prisma.$transaction(async (tx) => {
    await tx.section.update({ where: { id: sectionId }, data: { status } });
    await logActivity(tx, {
      projectId: section.project.id,
      actorId: session.user.id,
      message,
    });
  });

  revalidatePath("/");
  revalidatePath(`/projects/${section.project.id}`);
}

// Даты раздела — единственный источник данных для Ганта на дашборде
// (см. lib/dashboard/queries.ts, getProjectTimelines): по архитектуре
// (бриф, п.7) Гант не отдельная таблица, а визуализация startDate/deadline
// разделов, поэтому у самого проекта дат нет — только у Section.
export async function updateSectionDatesAction(
  sectionId: string,
  startDate: string | null,
  deadline: string | null,
) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: { projectId: true },
  });
  if (!section) {
    throw new Error("Раздел не найден");
  }

  if (!canManageOperations(session.user)) {
    throw new Error("Менять сроки раздела может только руководитель");
  }

  await prisma.section.update({
    where: { id: sectionId },
    data: {
      startDate: startDate ? new Date(startDate) : null,
      deadline: deadline ? new Date(deadline) : null,
    },
  });

  revalidatePath("/");
  revalidatePath(`/projects/${section.projectId}`);
}
